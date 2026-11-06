/**
 * Callable: createOrder
 * Validates cart, prices from Firestore, decrements stock in a transaction,
 * writes the order, returns orderId + WhatsApp message.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const REGION = "europe-west1";
const MAX_ITEMS = 20;
const MAX_QTY = 10;
const MIN_QTY = 1;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const PHONE_RE = /^(\+?[0-9]{8,15})$/;

/**
 * @param {string} value
 * @param {number} min
 * @param {number} max
 */
function assertString(value, min, max, field) {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${field} invalide.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new HttpsError(
      "invalid-argument",
      `${field} doit contenir entre ${min} et ${max} caractères.`
    );
  }
  return trimmed;
}

/**
 * Normalize Moroccan / international phone to digits with optional +.
 * @param {string} phone
 */
function normalizePhone(phone) {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (!PHONE_RE.test(cleaned)) {
    throw new HttpsError(
      "invalid-argument",
      "Numéro de téléphone invalide. Utilisez 8 à 15 chiffres."
    );
  }
  return cleaned;
}

/**
 * Resolve available stock for a product line.
 * @param {FirebaseFirestore.DocumentData} product
 * @param {string} size
 */
function getAvailableStock(product, size) {
  if (product.stockBySize && typeof product.stockBySize === "object") {
    const n = product.stockBySize[size];
    return typeof n === "number" ? n : 0;
  }
  if (typeof product.stock === "number") {
    return product.stock;
  }
  return 0;
}

/**
 * Apply flash sale discount if active.
 * @param {number} price
 * @param {object|null} flashSale
 * @param {string} productId
 */
function applyFlashSale(price, flashSale, productId) {
  if (!flashSale || !flashSale.active) return price;
  const now = Date.now();
  const start = flashSale.startAt?.toMillis?.() ?? Date.parse(flashSale.startAt || 0);
  const end = flashSale.endAt?.toMillis?.() ?? Date.parse(flashSale.endAt || 0);
  if (!Number.isFinite(start) || !Number.isFinite(end) || now < start || now > end) {
    return price;
  }
  const ids = Array.isArray(flashSale.productIds) ? flashSale.productIds : [];
  if (ids.length > 0 && !ids.includes(productId)) return price;
  const pct = Number(flashSale.discountPercent) || 0;
  if (pct <= 0 || pct > 90) return price;
  return Math.round(price * (1 - pct / 100) * 100) / 100;
}

/**
 * Apply promo code to subtotal.
 * @param {number} subtotal
 * @param {Array} promos
 * @param {string|null} code
 */
function applyPromo(subtotal, promos, code) {
  if (!code) return { subtotal, discount: 0, promoCode: null };
  const normalized = code.trim().toUpperCase();
  const promo = (promos || []).find(
    (p) => p && p.active !== false && String(p.code || "").toUpperCase() === normalized
  );
  if (!promo) {
    throw new HttpsError("invalid-argument", "Code promo invalide.");
  }
  const now = Date.now();
  if (promo.expiresAt) {
    const exp = promo.expiresAt.toMillis?.() ?? Date.parse(promo.expiresAt);
    if (Number.isFinite(exp) && now > exp) {
      throw new HttpsError("invalid-argument", "Code promo expiré.");
    }
  }
  let discount = 0;
  if (promo.type === "percent") {
    const pct = Number(promo.value) || 0;
    discount = Math.round(subtotal * (pct / 100) * 100) / 100;
  } else if (promo.type === "fixed") {
    discount = Math.min(subtotal, Number(promo.value) || 0);
  }
  return {
    subtotal: Math.max(0, Math.round((subtotal - discount) * 100) / 100),
    discount,
    promoCode: normalized,
  };
}

/**
 * Build WhatsApp confirmation message (French).
 */
function buildWhatsAppMessage(orderId, order, whatsappNumber) {
  const lines = [
    `*Nouvelle commande GMCrossfit*`,
    `N° ${orderId}`,
    ``,
    `*Client:* ${order.customer.name}`,
    `*Tél:* ${order.customer.phone}`,
    `*Ville:* ${order.customer.city}`,
    `*Adresse:* ${order.customer.address}`,
    ``,
    `*Articles:*`,
  ];
  for (const item of order.items) {
    lines.push(
      `• ${item.name} — ${item.size} / ${item.color} × ${item.qty} = ${item.unitPrice * item.qty} MAD`
    );
  }
  lines.push(``);
  lines.push(`Sous-total: ${order.subtotal} MAD`);
  if (order.promoCode) {
    lines.push(`Promo (${order.promoCode}): -${order.promoDiscount || 0} MAD`);
  }
  lines.push(`Livraison: ${order.deliveryFee} MAD`);
  lines.push(`*Total: ${order.total} MAD*`);
  lines.push(``);
  lines.push(`Statut: en attente de confirmation`);
  return lines.join("\n");
}

/**
 * Rate limit by IP and phone.
 */
async function checkRateLimit(db, ip, phone) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const keys = [`ip_${ip || "unknown"}`, `phone_${phone}`];

  for (const key of keys) {
    const ref = db.collection("rate_limits").doc(key);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      let stamps = [];
      if (snap.exists) {
        stamps = (snap.data().stamps || [])
          .map((t) => (t.toMillis ? t.toMillis() : Number(t)))
          .filter((t) => t > windowStart);
      }
      if (stamps.length >= RATE_LIMIT_MAX) {
        throw new HttpsError(
          "resource-exhausted",
          "Trop de commandes. Réessayez dans une heure."
        );
      }
      stamps.push(now);
      tx.set(ref, {
        stamps: stamps.map((t) => Timestamp.fromMillis(t)),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(now + RATE_LIMIT_WINDOW_MS),
      });
    });
  }
}

const createOrder = onCall(
  {
    region: REGION,
    cors: true,
    maxInstances: 20,
  },
  async (request) => {
    const data = request.data || {};
    const db = getFirestore();

    // Honeypot — bots fill this; humans leave it empty
    if (data.website || data.honeypot) {
      throw new HttpsError("invalid-argument", "Requête rejetée.");
    }

    // Customer validation
    const customer = data.customer || {};
    const name = assertString(customer.name, 2, 80, "Nom");
    const phone = normalizePhone(assertString(customer.phone, 8, 20, "Téléphone"));
    const city = assertString(customer.city, 2, 60, "Ville");
    const address = assertString(customer.address, 5, 200, "Adresse");

    // Items validation
    const rawItems = data.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new HttpsError("invalid-argument", "Le panier est vide.");
    }
    if (rawItems.length > MAX_ITEMS) {
      throw new HttpsError("invalid-argument", `Maximum ${MAX_ITEMS} articles.`);
    }

    const promoCodeInput =
      typeof data.promoCode === "string" && data.promoCode.trim()
        ? data.promoCode.trim()
        : null;

    // Rate limit
    const ip =
      request.rawRequest?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      request.rawRequest?.ip ||
      "unknown";
    await checkRateLimit(db, ip, phone);

    // Load public settings
    const settingsSnap = await db.collection("settings").doc("public").get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    const deliveryCfg = settings.delivery || { fee: 30, freeThreshold: 500 };
    const flashSale = settings.flashSale || null;
    const promos = settings.promos || [];
    const whatsappNumber = settings.whatsappNumber || "";

    // Validate & price each line inside a transaction (stock + order write)
    const orderRef = db.collection("orders").doc();

    const result = await db.runTransaction(async (tx) => {
      const pricedItems = [];
      let subtotal = 0;

      // Collect unique product refs first (read all before writes)
      const productCache = new Map();
      for (const line of rawItems) {
        const productId = String(line.productId || "").trim();
        if (!productId) {
          throw new HttpsError("invalid-argument", "productId manquant.");
        }
        if (!productCache.has(productId)) {
          const pref = db.collection("products").doc(productId);
          const psnap = await tx.get(pref);
          if (!psnap.exists) {
            throw new HttpsError("not-found", `Produit introuvable: ${productId}`);
          }
          productCache.set(productId, { ref: pref, data: psnap.data() });
        }
      }

      for (const line of rawItems) {
        const productId = String(line.productId || "").trim();
        const size = String(line.size || "").trim().toUpperCase();
        const color = String(line.color || "").trim();
        const qty = Number(line.qty);

        if (!size || size.length > 10) {
          throw new HttpsError("invalid-argument", "Taille invalide.");
        }
        if (!color || color.length > 40) {
          throw new HttpsError("invalid-argument", "Couleur invalide.");
        }
        if (!Number.isInteger(qty) || qty < MIN_QTY || qty > MAX_QTY) {
          throw new HttpsError(
            "invalid-argument",
            `Quantité doit être entre ${MIN_QTY} et ${MAX_QTY}.`
          );
        }

        const { ref, data: product } = productCache.get(productId);
        const sizes = (product.sizes || []).map((s) => String(s).toUpperCase());
        if (!sizes.includes(size)) {
          throw new HttpsError(
            "invalid-argument",
            `Taille ${size} indisponible pour ${product.name}.`
          );
        }
        const colors = product.colors || [];
        const colorMatch = colors.find(
          (c) => String(c.name || "").toLowerCase() === color.toLowerCase()
        );
        if (!colorMatch) {
          throw new HttpsError(
            "invalid-argument",
            `Couleur ${color} indisponible pour ${product.name}.`
          );
        }

        const available = getAvailableStock(product, size);
        if (available < qty) {
          throw new HttpsError(
            "failed-precondition",
            `Stock insuffisant pour ${product.name} (${size}). Disponible: ${available}.`
          );
        }

        let unitPrice = Number(product.price);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw new HttpsError("internal", `Prix invalide pour ${product.name}.`);
        }
        unitPrice = applyFlashSale(unitPrice, flashSale, productId);

        pricedItems.push({
          productId,
          name: product.name,
          size,
          color: colorMatch.name,
          qty,
          unitPrice,
          _ref: ref,
          _product: product,
        });
        subtotal += unitPrice * qty;

        // Decrement stock in memory for subsequent lines of same product
        if (product.stockBySize && typeof product.stockBySize === "object") {
          product.stockBySize[size] = available - qty;
        } else if (typeof product.stock === "number") {
          product.stock = available - qty;
        }
      }

      // Merge identical lines for the stored order
      const merged = new Map();
      for (const item of pricedItems) {
        const key = `${item.productId}|${item.size}|${item.color}`;
        if (merged.has(key)) {
          merged.get(key).qty += item.qty;
        } else {
          merged.set(key, { ...item });
        }
      }
      const finalItems = Array.from(merged.values()).map(
        ({ productId, name, size, color, qty, unitPrice }) => ({
          productId,
          name,
          size,
          color,
          qty,
          unitPrice,
        })
      );

      const promoResult = applyPromo(subtotal, promos, promoCodeInput);
      const afterPromo = promoResult.subtotal;
      const fee = Number(deliveryCfg.fee) || 0;
      const freeThreshold = Number(deliveryCfg.freeThreshold) || 0;
      const deliveryFee = freeThreshold > 0 && afterPromo >= freeThreshold ? 0 : fee;
      const total = Math.round((afterPromo + deliveryFee) * 100) / 100;

      // Persist stock decrements
      for (const item of pricedItems) {
        const product = item._product;
        if (product.stockBySize && typeof product.stockBySize === "object") {
          tx.update(item._ref, { stockBySize: product.stockBySize });
        } else {
          tx.update(item._ref, { stock: product.stock });
        }
      }

      const order = {
        items: finalItems,
        subtotal: Math.round(subtotal * 100) / 100,
        promoCode: promoResult.promoCode,
        promoDiscount: promoResult.discount,
        deliveryFee,
        total,
        customer: { name, phone, city, address },
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
        ip,
      };

      tx.set(orderRef, order);
      return { orderId: orderRef.id, order, whatsappNumber };
    });

    const whatsappMessage = buildWhatsAppMessage(
      result.orderId,
      {
        ...result.order,
        customer: { name, phone, city, address },
      },
      result.whatsappNumber
    );

    return {
      orderId: result.orderId,
      total: result.order.total,
      whatsappMessage,
      whatsappNumber: result.whatsappNumber,
    };
  }
);

module.exports = { createOrder };
