/**
 * HTTP: /p/<productId> — Open Graph HTML for social previews, then redirect humans.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");

const REGION = "europe-west1";
const SITE_URL = process.env.SITE_URL || "https://gmcrossfit.web.app";
const CURRENCY = "MAD";

/**
 * Escape for HTML attribute / text content.
 */
function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Resolve primary product image URL.
 */
function resolveImage(product) {
  if (product.imageUrl) return product.imageUrl;
  if (Array.isArray(product.images) && product.images[0]) {
    const first = product.images[0];
    return typeof first === "string" ? first : first.url || "";
  }
  return `${SITE_URL}/assets/logo.jpg`;
}

/**
 * Extract product id from path /p/<id> or /p/<id>/...
 */
function extractProductId(path) {
  const parts = String(path || "").split("/").filter(Boolean);
  // parts[0] === 'p', parts[1] === id
  if (parts[0] === "p" && parts[1]) return parts[1];
  return null;
}

const productShare = onRequest(
  {
    region: REGION,
    cors: false,
    maxInstances: 20,
  },
  async (req, res) => {
    try {
      const productId = extractProductId(req.path);
      if (!productId) {
        res.status(404).send("Produit introuvable");
        return;
      }

      const db = getFirestore();
      const snap = await db.collection("products").doc(productId).get();
      if (!snap.exists) {
        res.status(404).send("Produit introuvable");
        return;
      }

      const product = snap.data();
      const name = product.name || "Produit GMCrossfit";
      const description =
        (product.description || "Tenue CrossFit premium GMCrossfit.").slice(0, 300);
      const image = resolveImage(product);
      const price = Number(product.price) || 0;
      const shareUrl = `${SITE_URL}/p/${productId}`;
      const detailUrl = `${SITE_URL}/produit-detail.html?id=${encodeURIComponent(productId)}`;
      const inStock =
        (typeof product.stock === "number" && product.stock > 0) ||
        (product.stockBySize &&
          Object.values(product.stockBySize).some((n) => Number(n) > 0));

      const jsonLd = {
        "@context": "https://schema.org/",
        "@type": "Product",
        name,
        image: [image],
        description,
        brand: { "@type": "Brand", name: "GMCrossfit" },
        offers: {
          "@type": "Offer",
          url: shareUrl,
          priceCurrency: CURRENCY,
          price: String(price),
          availability: inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        },
      };

      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${esc(name)} | GMCrossfit</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(shareUrl)}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="GMCrossfit">
  <meta property="og:title" content="${esc(name)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(shareUrl)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:image:alt" content="${esc(name)}">
  <meta property="product:price:amount" content="${esc(String(price))}">
  <meta property="product:price:currency" content="${CURRENCY}">
  <meta property="og:price:amount" content="${esc(String(price))}">
  <meta property="og:price:currency" content="${CURRENCY}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(name)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(image)}">
  <meta http-equiv="refresh" content="0;url=${esc(detailUrl)}">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <script>location.replace(${JSON.stringify(detailUrl)});</script>
</head>
<body>
  <p>Redirection vers <a href="${esc(detailUrl)}">${esc(name)}</a>…</p>
</body>
</html>`;

      res.set("Cache-Control", "public, s-maxage=3600, max-age=600");
      res.set("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(html);
    } catch (err) {
      console.error("productShare error:", err);
      res.status(500).send("Erreur serveur");
    }
  }
);

module.exports = { productShare };
