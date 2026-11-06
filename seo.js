/**
 * Per-page SEO titles / meta descriptions (French).
 * Call applySeo() on each static page; product pages set meta dynamically in script.js.
 */
const SITE = "GMCrossfit";
const DEFAULT_DESC =
  "GMCrossfit — sportswear CrossFit premium. T-shirts, tanks, shorts, leggings, hoodies. Livraison rapide, paiement à la livraison.";

const PAGES = {
  "/": {
    title: `${SITE} — Sportswear CrossFit Premium`,
    description: DEFAULT_DESC,
  },
  "/index.html": {
    title: `${SITE} — Sportswear CrossFit Premium`,
    description: DEFAULT_DESC,
  },
  "/produits.html": {
    title: `Boutique | ${SITE}`,
    description:
      "Parcourez toute la collection GMCrossfit : t-shirts, débardeurs, shorts, leggings, hoodies et accessoires.",
  },
  "/produit-detail.html": {
    title: `Produit | ${SITE}`,
    description: "Détail produit GMCrossfit — choisissez taille et couleur.",
  },
  "/packs.html": {
    title: `Packs WOD | ${SITE}`,
    description: "Packs CrossFit complets GMCrossfit — tenues coordonnées à prix avantageux.",
  },
  "/pack-detail.html": {
    title: `Pack | ${SITE}`,
    description: "Détail du pack GMCrossfit.",
  },
  "/panier.html": {
    title: `Panier & Commande | ${SITE}`,
    description: "Votre panier GMCrossfit — finalisez votre commande via WhatsApp.",
  },
  "/venteflash.html": {
    title: `Vente Flash | ${SITE}`,
    description: "Vente flash GMCrossfit — réductions limitées dans le temps.",
  },
  "/apropos.html": {
    title: `À propos | ${SITE}`,
    description: "L'histoire et les valeurs de GMCrossfit — performance, qualité, style streetwear gym.",
  },
  "/contact.html": {
    title: `Contact | ${SITE}`,
    description: "Contactez GMCrossfit par WhatsApp ou formulaire.",
  },
  "/size-guide.html": {
    title: `Guide des tailles | ${SITE}`,
    description: "Guide des tailles GMCrossfit — trouvez votre coupe idéale.",
  },
  "/404.html": {
    title: `Page introuvable | ${SITE}`,
    description: "Cette page n'existe pas.",
  },
};

/**
 * Normalize path for lookup.
 */
function pageKey() {
  let path = window.location.pathname || "/";
  if (path.endsWith("/") && path !== "/") path = path.slice(0, -1);
  if (path === "" || path === "/") return "/";
  // Handle file opened via live-server without leading path quirks
  const file = path.split("/").pop();
  if (file && file.endsWith(".html")) return "/" + file;
  return path;
}

/**
 * Ensure a meta tag exists and set content.
 */
function setMeta(attr, key, content) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Apply SEO for the current static page.
 * @param {{ title?: string, description?: string, image?: string, url?: string, noindex?: boolean }} [override]
 */
export function applySeo(override = {}) {
  const conf = { ...(PAGES[pageKey()] || { title: SITE, description: DEFAULT_DESC }), ...override };
  document.title = conf.title;
  setMeta("name", "description", conf.description);
  setMeta("property", "og:title", conf.title);
  setMeta("property", "og:description", conf.description);
  setMeta("property", "og:type", "website");
  setMeta("property", "og:site_name", SITE);
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", conf.title);
  setMeta("name", "twitter:description", conf.description);

  const image = conf.image || new URL("assets/logo.jpg", window.location.origin).href;
  setMeta("property", "og:image", image);
  setMeta("name", "twitter:image", image);

  const url = conf.url || window.location.href;
  setMeta("property", "og:url", url);

  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = url;

  if (conf.noindex) {
    setMeta("name", "robots", "noindex,nofollow");
  }
}

/**
 * Build share URL that hits the Open Graph function (/p/<id>).
 * @param {string} productId
 */
export function productShareUrl(productId) {
  return new URL(`/p/${productId}`, window.location.origin).href;
}

/**
 * Native / clipboard share for a product.
 * @param {{ id: string, name: string, description?: string }} product
 */
export async function shareProduct(product) {
  const url = productShareUrl(product.id);
  const payload = {
    title: product.name,
    text: product.description?.slice(0, 120) || product.name,
    url,
  };
  if (navigator.share) {
    await navigator.share(payload);
    return;
  }
  await navigator.clipboard.writeText(url);
  return "copied";
}

// Auto-apply on load for static pages
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => applySeo());
  } else {
    applySeo();
  }
}
