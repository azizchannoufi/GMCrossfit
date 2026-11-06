/**
 * Checkout: call createOrder callable, then open WhatsApp with server-built message.
 */
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";
import { getFirebase } from "./firebase-init.js";
import { getCart, clearCart, toCheckoutPayload } from "./cart.js";
import { getPublicSettings } from "./data-cache.js";

/**
 * Client-side form validation (server re-validates everything).
 * @param {HTMLFormElement} form
 * @returns {{ ok: boolean, errors: string[], customer: object, promoCode: string|null, honeypot: string }}
 */
export function validateCheckoutForm(form) {
  const errors = [];
  const fd = new FormData(form);
  const name = String(fd.get("name") || "").trim();
  const phone = String(fd.get("phone") || "").trim().replace(/[\s\-().]/g, "");
  const city = String(fd.get("city") || "").trim();
  const address = String(fd.get("address") || "").trim();
  const promoCode = String(fd.get("promoCode") || "").trim() || null;
  const honeypot = String(fd.get("website") || "").trim();

  if (name.length < 2 || name.length > 80) errors.push("Nom invalide (2–80 caractères).");
  if (!/^(\+?[0-9]{8,15})$/.test(phone)) errors.push("Téléphone invalide.");
  if (city.length < 2 || city.length > 60) errors.push("Ville invalide.");
  if (address.length < 5 || address.length > 200) errors.push("Adresse invalide.");
  if (!getCart().length) errors.push("Votre panier est vide.");

  return {
    ok: errors.length === 0,
    errors,
    customer: { name, phone, city, address },
    promoCode,
    honeypot,
  };
}

/**
 * Build wa.me URL from number + message.
 * @param {string} number
 * @param {string} message
 */
export function buildWhatsAppUrl(number, message) {
  const digits = String(number || "").replace(/[^\d]/g, "");
  const text = encodeURIComponent(message || "");
  if (!digits) return `https://wa.me/?text=${text}`;
  return `https://wa.me/${digits}?text=${text}`;
}

/**
 * Submit order to Cloud Function and open WhatsApp.
 * @param {HTMLFormElement} form
 * @param {{ onStatus?: (msg: string) => void }} [opts]
 */
export async function submitCheckout(form, opts = {}) {
  const status = opts.onStatus || (() => {});
  const validation = validateCheckoutForm(form);

  // Silent reject for honeypot fills
  if (validation.honeypot) {
    status("Commande envoyée.");
    return { fake: true };
  }

  if (!validation.ok) {
    const err = new Error(validation.errors.join(" "));
    err.validation = validation.errors;
    throw err;
  }

  status("Validation de la commande…");
  const { functions } = getFirebase();
  const createOrder = httpsCallable(functions, "createOrder");

  const payload = {
    items: toCheckoutPayload(),
    customer: validation.customer,
    promoCode: validation.promoCode,
    website: "", // honeypot empty
  };

  status("Création de la commande…");
  const result = await createOrder(payload);
  const data = result.data || {};

  if (!data.orderId) {
    throw new Error("Réponse serveur invalide.");
  }

  clearCart();

  let whatsappNumber = data.whatsappNumber;
  if (!whatsappNumber) {
    try {
      const settings = await getPublicSettings();
      whatsappNumber = settings.whatsappNumber || "";
    } catch {
      whatsappNumber = "";
    }
  }

  const url = buildWhatsAppUrl(whatsappNumber, data.whatsappMessage || "");
  status("Ouverture de WhatsApp…");
  window.open(url, "_blank", "noopener,noreferrer");

  return {
    orderId: data.orderId,
    total: data.total,
    whatsappUrl: url,
  };
}

/**
 * Wire a checkout form element.
 * @param {string|HTMLFormElement} formOrSelector
 */
export function initCheckoutForm(formOrSelector) {
  const form =
    typeof formOrSelector === "string"
      ? document.querySelector(formOrSelector)
      : formOrSelector;
  if (!form) return;

  const errorEl = form.querySelector("[data-checkout-errors]");
  const statusEl = form.querySelector("[data-checkout-status]");
  const submitBtn = form.querySelector('[type="submit"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.textContent = "";
    if (statusEl) statusEl.textContent = "";
    if (submitBtn) submitBtn.disabled = true;

    try {
      const result = await submitCheckout(form, {
        onStatus: (msg) => {
          if (statusEl) statusEl.textContent = msg;
        },
      });
      if (result.orderId) {
        if (statusEl) {
          statusEl.textContent = `Commande ${result.orderId} créée. Total: ${result.total} MAD.`;
        }
        form.reset();
        // Redirect to thank-you state on same page
        const thankYou = document.querySelector("[data-checkout-success]");
        if (thankYou) {
          thankYou.hidden = false;
          thankYou.querySelector("[data-order-id]")?.replaceChildren(
            document.createTextNode(result.orderId)
          );
        }
      }
    } catch (err) {
      console.error(err);
      const msg =
        err?.message ||
        err?.code ||
        "Impossible de créer la commande. Réessayez.";
      // Firebase HttpsError message is in err.message
      if (errorEl) errorEl.textContent = msg.replace(/^Firebase:\s*/i, "");
      else alert(msg);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
