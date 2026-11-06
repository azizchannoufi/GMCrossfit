/**
 * HTTP: dynamic sitemap.xml listing static pages + all products.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");

const REGION = "europe-west1";
const SITE_URL = process.env.SITE_URL || "https://gmcrossfit.web.app";

const STATIC_PAGES = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/produits.html", priority: "0.9", changefreq: "daily" },
  { path: "/packs.html", priority: "0.8", changefreq: "weekly" },
  { path: "/venteflash.html", priority: "0.8", changefreq: "daily" },
  { path: "/apropos.html", priority: "0.5", changefreq: "monthly" },
  { path: "/contact.html", priority: "0.5", changefreq: "monthly" },
  { path: "/size-guide.html", priority: "0.4", changefreq: "monthly" },
  { path: "/panier.html", priority: "0.3", changefreq: "monthly" },
];

function formatDate(ts) {
  if (!ts) return new Date().toISOString().slice(0, 10);
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function urlEntry(loc, lastmod, changefreq, priority) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

const sitemap = onRequest(
  {
    region: REGION,
    cors: false,
    maxInstances: 5,
  },
  async (req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const entries = STATIC_PAGES.map((p) =>
        urlEntry(`${SITE_URL}${p.path}`, today, p.changefreq, p.priority)
      );

      const db = getFirestore();
      const snap = await db.collection("products").get();
      snap.forEach((doc) => {
        const data = doc.data();
        entries.push(
          urlEntry(
            `${SITE_URL}/p/${doc.id}`,
            formatDate(data.createdAt || data.updatedAt),
            "weekly",
            "0.7"
          )
        );
        entries.push(
          urlEntry(
            `${SITE_URL}/produit-detail.html?id=${encodeURIComponent(doc.id)}`,
            formatDate(data.createdAt || data.updatedAt),
            "weekly",
            "0.6"
          )
        );
      });

      const packsSnap = await db.collection("packs").get();
      packsSnap.forEach((doc) => {
        entries.push(
          urlEntry(
            `${SITE_URL}/pack-detail.html?id=${encodeURIComponent(doc.id)}`,
            today,
            "weekly",
            "0.6"
          )
        );
      });

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;

      res.set("Cache-Control", "public, s-maxage=3600, max-age=600");
      res.set("Content-Type", "application/xml; charset=utf-8");
      res.status(200).send(xml);
    } catch (err) {
      console.error("sitemap error:", err);
      res.status(500).send("Erreur sitemap");
    }
  }
);

module.exports = { sitemap };
