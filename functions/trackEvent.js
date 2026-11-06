/**
 * Callable: trackEvent — validated, rate-limited analytics writes.
 * Types: page_view | product_click
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const REGION = "europe-west1";
const RATE_LIMIT_MAX = 60; // per IP per hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const ALLOWED_TYPES = new Set(["page_view", "product_click"]);

const trackEvent = onCall(
  {
    region: REGION,
    cors: true,
    maxInstances: 30,
  },
  async (request) => {
    const data = request.data || {};
    const type = String(data.type || "").trim();
    if (!ALLOWED_TYPES.has(type)) {
      throw new HttpsError("invalid-argument", "Type d'événement invalide.");
    }

    const path = String(data.path || "").slice(0, 200);
    const productId = data.productId ? String(data.productId).slice(0, 80) : null;
    const referrer = String(data.referrer || "").slice(0, 300);
    const userAgent = String(
      request.rawRequest?.headers?.["user-agent"] || ""
    ).slice(0, 300);

    if (type === "product_click" && !productId) {
      throw new HttpsError("invalid-argument", "productId requis.");
    }

    const ip =
      request.rawRequest?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      request.rawRequest?.ip ||
      "unknown";

    const db = getFirestore();
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const rateRef = db.collection("rate_limits").doc(`track_${ip}`);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(rateRef);
      let stamps = [];
      if (snap.exists) {
        stamps = (snap.data().stamps || [])
          .map((t) => (t.toMillis ? t.toMillis() : Number(t)))
          .filter((t) => t > windowStart);
      }
      if (stamps.length >= RATE_LIMIT_MAX) {
        throw new HttpsError("resource-exhausted", "Trop de requêtes.");
      }
      stamps.push(now);
      tx.set(rateRef, {
        stamps: stamps.map((t) => Timestamp.fromMillis(t)),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(now + RATE_LIMIT_WINDOW_MS),
      });
    });

    const collection = type === "page_view" ? "page_views" : "product_clicks";
    const payload = {
      path,
      referrer,
      userAgent,
      ip,
      createdAt: FieldValue.serverTimestamp(),
    };
    if (productId) payload.productId = productId;

    await db.collection(collection).add(payload);
    return { ok: true };
  }
);

module.exports = { trackEvent };
