/**
 * Firestore onCreate trigger: send Telegram notification for new orders.
 * Uses Secret Manager — never throws to the caller path (orders already written).
 */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");

const REGION = "europe-west1";
const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = defineSecret("TELEGRAM_CHAT_ID");

/**
 * Escape HTML special chars for Telegram parse_mode HTML.
 * @param {string} text
 */
function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Build Telegram HTML message from order document.
 */
function buildTelegramMessage(orderId, order) {
  const c = order.customer || {};
  const lines = [
    `<b>🛒 Nouvelle commande GMCrossfit</b>`,
    `<b>N°:</b> <code>${escapeHtml(orderId)}</code>`,
    ``,
    `<b>Client:</b> ${escapeHtml(c.name)}`,
    `<b>Tél:</b> ${escapeHtml(c.phone)}`,
    `<b>Ville:</b> ${escapeHtml(c.city)}`,
    `<b>Adresse:</b> ${escapeHtml(c.address)}`,
    ``,
    `<b>Articles:</b>`,
  ];
  for (const item of order.items || []) {
    lines.push(
      `• ${escapeHtml(item.name)} — ${escapeHtml(item.size)} / ${escapeHtml(item.color)} × ${item.qty} = ${item.unitPrice * item.qty} MAD`
    );
  }
  lines.push(``);
  lines.push(`Sous-total: ${order.subtotal} MAD`);
  if (order.promoCode) {
    lines.push(`Promo (${escapeHtml(order.promoCode)}): -${order.promoDiscount || 0} MAD`);
  }
  lines.push(`Livraison: ${order.deliveryFee} MAD`);
  lines.push(`<b>Total: ${order.total} MAD</b>`);
  lines.push(`Statut: ${escapeHtml(order.status || "pending")}`);
  return lines.join("\n");
}

const notifyOrder = onDocumentCreated(
  {
    document: "orders/{orderId}",
    region: REGION,
    secrets: [TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID],
    maxInstances: 10,
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return;
      const order = snap.data();
      const orderId = event.params.orderId;

      const token = TELEGRAM_BOT_TOKEN.value();
      const chatId = TELEGRAM_CHAT_ID.value();
      if (!token || !chatId) {
        console.warn("Telegram secrets missing — skip notification.");
        return;
      }

      const text = buildTelegramMessage(orderId, order);
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error("Telegram API error:", res.status, body);
      }
    } catch (err) {
      // Never throw — order must not be blocked by notification failures
      console.error("notifyOrder failed:", err);
    }
  }
);

module.exports = { notifyOrder };
