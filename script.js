/**
 * Catalog, product detail, packs, home page, and analytics tracking.
 */
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";
import { getFirebase } from "./firebase-init.js";
import {
  getProducts,
  getProduct,
  getCategories,
  getPacks,
  getPack,
  getPublicSettings,
} from "./data-cache.js";
import { resolveImageSync, resolveGallery } from "./image-resolve.js";
import { addToCart } from "./cart.js";
import { applySeo, productShareUrl, shareProduct } from "./seo.js";
import { initFlashTeaser, flashPrice, isFlashSaleActive } from "./flashsale.js";
import { initBanner } from "./banner.js";
import "./components.js";
import "./mobile-nav.js";

/* ─── Utilities ─── */

function $(sel, root = document) {
  return root.querySelector(sel);
}

function $$(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPrice(n) {
  return `${Number(n).toFixed(0)} MAD`;
}

function getStock(product, size) {
  if (product.stockBySize && size && typeof product.stockBySize[size] === "number") {
    return product.stockBySize[size];
  }
  if (typeof product.stock === "number") return product.stock;
  return 0;
}

function totalStock(product) {
  if (product.stockBySize && typeof product.stockBySize === "object") {
    return Object.values(product.stockBySize).reduce((a, b) => a + (Number(b) || 0), 0);
  }
  return typeof product.stock === "number" ? product.stock : 0;
}

function skeletonCards(n = 8) {
  return Array.from({ length: n })
    .map(
      () =>
        `<div class="product-card product-card--skeleton" aria-hidden="true">
          <div class="skeleton skeleton--media"></div>
          <div class="skeleton skeleton--line"></div>
          <div class="skeleton skeleton--line skeleton--short"></div>
        </div>`
    )
    .join("");
}

/**
 * Product card HTML.
 */
function productCardHtml(p, flashSale = null) {
  const img = resolveImageSync(p);
  const hover = p.imageHover || "";
  const price = flashSale ? flashPrice(p.price, flashSale, p.id) : p.price;
  const onSale = flashSale && isFlashSaleActive(flashSale) && price < p.price;
  const badges = [];
  if (p.isNew) badges.push('<span class="badge badge--new">New</span>');
  if (p.isHot) badges.push('<span class="badge badge--hot">Hot</span>');
  if (onSale) {
    const pct = Number(flashSale.discountPercent) || 0;
    if (pct) badges.push(`<span class="badge badge--sale">-${pct}%</span>`);
  }

  return `
  <article class="product-card" data-product-id="${escapeHtml(p.id)}">
    <a href="produit-detail.html?id=${encodeURIComponent(p.id)}" class="product-card__media" data-track-product="${escapeHtml(p.id)}">
      <img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" loading="lazy" width="400" height="500" class="product-card__img">
      ${hover ? `<img src="${escapeHtml(hover)}" alt="" loading="lazy" class="product-card__img product-card__img--hover" aria-hidden="true">` : ""}
      <div class="product-card__badges">${badges.join("")}</div>
    </a>
    <div class="product-card__body">
      <p class="product-card__cat">${escapeHtml(p.category || "")}</p>
      <h3 class="product-card__title">
        <a href="produit-detail.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a>
      </h3>
      <p class="product-card__price">
        <span class="price${onSale ? " price--sale" : ""}">${formatPrice(price)}</span>
        ${onSale || p.oldPrice ? `<span class="price price--old">${formatPrice(onSale ? p.price : p.oldPrice)}</span>` : ""}
      </p>
    </div>
  </article>`;
}

/* ─── Tracking ─── */

let _trackFn = null;

async function track(type, payload = {}) {
  try {
    if (!_trackFn) {
      const { functions } = getFirebase();
      _trackFn = httpsCallable(functions, "trackEvent");
    }
    await _trackFn({
      type,
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || "",
      ...payload,
    });
  } catch (err) {
    // Analytics must never break UX
    console.debug("[track]", err.message);
  }
}

function initTracking() {
  track("page_view");
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-track-product]");
    if (a) {
      track("product_click", { productId: a.getAttribute("data-track-product") });
    }
  });
}

/* ─── Toast ─── */

function toast(message, type = "ok") {
  let el = $(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.dataset.type = type;
  el.classList.add("is-visible");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("is-visible"), 2600);
}

/* ─── Home ─── */

async function initHome() {
  const featured = $("[data-featured-grid]");
  const cats = $("[data-categories-grid]");
  if (!featured && !cats) return;

  initFlashTeaser();
  initBanner();

  if (featured) featured.innerHTML = skeletonCards(4);

  try {
    const [products, categories, settings] = await Promise.all([
      getProducts(),
      getCategories(),
      getPublicSettings(),
    ]);
    const flash = settings.flashSale;

    if (featured) {
      const list = products.filter((p) => p.isHot || p.isNew).slice(0, 8);
      featured.innerHTML = (list.length ? list : products.slice(0, 8))
        .map((p) => productCardHtml(p, flash))
        .join("");
    }

    if (cats) {
      cats.innerHTML = categories
        .map(
          (c) => `
        <a href="produits.html?category=${encodeURIComponent(c.name)}" class="category-tile">
          <img src="${escapeHtml(c.imageUrl || "assets/logo.jpg")}" alt="" loading="lazy">
          <span>${escapeHtml(c.name)}</span>
        </a>`
        )
        .join("");
    }
  } catch (err) {
    console.error(err);
    if (featured) {
      featured.innerHTML = `<p class="empty-state">Impossible de charger le catalogue. Vérifiez Firebase / les émulateurs.</p>`;
    }
  }
}

/* ─── Products listing + filters ─── */

function readFiltersFromURL() {
  const p = new URLSearchParams(window.location.search);
  return {
    category: p.get("category") || "",
    size: p.get("size") || "",
    color: p.get("color") || "",
    gender: p.get("gender") || "",
    q: p.get("q") || "",
    sort: p.get("sort") || "newest",
    min: p.get("min") || "",
    max: p.get("max") || "",
  };
}

function writeFiltersToURL(filters) {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) p.set(k, v);
  });
  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

function filterProducts(products, filters, flashSale) {
  let list = [...products];
  const q = filters.q.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
    );
  }
  if (filters.category) {
    list = list.filter(
      (p) => p.category?.toLowerCase() === filters.category.toLowerCase()
    );
  }
  if (filters.gender) {
    list = list.filter((p) => p.gender === filters.gender);
  }
  if (filters.size) {
    list = list.filter((p) =>
      (p.sizes || []).map(String).includes(filters.size)
    );
  }
  if (filters.color) {
    list = list.filter((p) =>
      (p.colors || []).some(
        (c) => c.name?.toLowerCase() === filters.color.toLowerCase()
      )
    );
  }
  const min = filters.min !== "" ? Number(filters.min) : null;
  const max = filters.max !== "" ? Number(filters.max) : null;
  if (min != null && Number.isFinite(min)) {
    list = list.filter((p) => flashPrice(p.price, flashSale, p.id) >= min);
  }
  if (max != null && Number.isFinite(max)) {
    list = list.filter((p) => flashPrice(p.price, flashSale, p.id) <= max);
  }

  switch (filters.sort) {
    case "price-asc":
      list.sort(
        (a, b) =>
          flashPrice(a.price, flashSale, a.id) - flashPrice(b.price, flashSale, b.id)
      );
      break;
    case "price-desc":
      list.sort(
        (a, b) =>
          flashPrice(b.price, flashSale, b.id) - flashPrice(a.price, flashSale, a.id)
      );
      break;
    case "name":
      list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
      break;
    case "newest":
    default:
      list.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }
  return list;
}

async function initProductsPage() {
  const grid = $("[data-products-grid]");
  if (!grid) return;

  const countEl = $("[data-products-count]");
  const form = $("[data-filters]");
  grid.innerHTML = skeletonCards(12);

  let products = [];
  let flashSale = null;

  try {
    const [prods, settings, categories] = await Promise.all([
      getProducts(),
      getPublicSettings(),
      getCategories(),
    ]);
    products = prods;
    flashSale = settings.flashSale;

    const catSelect = form?.querySelector('[name="category"]');
    if (catSelect && catSelect.options.length <= 1) {
      categories.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.name;
        opt.textContent = c.name;
        catSelect.appendChild(opt);
      });
    }

    // Collect sizes / colors for filter selects
    const sizes = new Set();
    const colors = new Set();
    products.forEach((p) => {
      (p.sizes || []).forEach((s) => sizes.add(s));
      (p.colors || []).forEach((c) => colors.add(c.name));
    });
    const sizeSelect = form?.querySelector('[name="size"]');
    if (sizeSelect && sizeSelect.options.length <= 1) {
      [...sizes].sort().forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        sizeSelect.appendChild(opt);
      });
    }
    const colorSelect = form?.querySelector('[name="color"]');
    if (colorSelect && colorSelect.options.length <= 1) {
      [...colors].sort().forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        colorSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p class="empty-state">Erreur de chargement du catalogue.</p>`;
    return;
  }

  const apply = () => {
    const filters = form
      ? {
          category: form.category.value,
          size: form.size.value,
          color: form.color.value,
          gender: form.gender?.value || "",
          q: form.q.value,
          sort: form.sort.value,
          min: form.min.value,
          max: form.max.value,
        }
      : readFiltersFromURL();

    writeFiltersToURL(filters);
    const list = filterProducts(products, filters, flashSale);
    if (countEl) countEl.textContent = `${list.length} produit${list.length > 1 ? "s" : ""}`;
    grid.innerHTML = list.length
      ? list.map((p) => productCardHtml(p, flashSale)).join("")
      : `<p class="empty-state">Aucun produit ne correspond à vos filtres.</p>`;
  };

  // Prefill from URL
  const initial = readFiltersFromURL();
  if (form) {
    Object.entries(initial).forEach(([k, v]) => {
      if (form[k] != null) form[k].value = v;
    });
    form.addEventListener("input", () => apply());
    form.addEventListener("change", () => apply());
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      apply();
    });
    $("[data-filters-reset]")?.addEventListener("click", () => {
      form.reset();
      apply();
    });
  }
  apply();
}

/* ─── Product detail ─── */

async function initProductDetail() {
  const root = $("[data-product-detail]");
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    root.innerHTML = `<p class="empty-state">Produit introuvable. <a href="produits.html">Retour boutique</a></p>`;
    return;
  }

  root.innerHTML = `<div class="product-detail product-detail--loading">${skeletonCards(1)}</div>`;

  try {
    const [product, settings, allProducts] = await Promise.all([
      getProduct(id),
      getPublicSettings(),
      getProducts(),
    ]);
    if (!product) {
      root.innerHTML = `<p class="empty-state">Produit introuvable. <a href="produits.html">Retour boutique</a></p>`;
      return;
    }

    const flash = settings.flashSale;
    const price = flashPrice(product.price, flash, product.id);
    const gallery = await resolveGallery(product);
    const stockTotal = totalStock(product);

    applySeo({
      title: `${product.name} | GMCrossfit`,
      description: (product.description || "").slice(0, 160),
      image: gallery[0],
      url: productShareUrl(product.id),
    });

    const sizes = product.sizes || ["S", "M", "L", "XL"];
    const colors = product.colors || [{ name: "Noir", hex: "#111" }];

    root.innerHTML = `
    <div class="product-detail">
      <div class="product-detail__gallery">
        <div class="product-detail__main-img">
          <img src="${escapeHtml(gallery[0])}" alt="${escapeHtml(product.name)}" data-main-img width="800" height="1000">
        </div>
        <div class="product-detail__thumbs" data-thumbs>
          ${gallery
            .map(
              (u, i) =>
                `<button type="button" class="thumb${i === 0 ? " is-active" : ""}" data-thumb="${escapeHtml(u)}">
                  <img src="${escapeHtml(u)}" alt="" loading="lazy">
                </button>`
            )
            .join("")}
        </div>
      </div>
      <div class="product-detail__info">
        <p class="eyebrow">${escapeHtml(product.category || "")} · ${escapeHtml(product.gender || "unisex")}</p>
        <h1>${escapeHtml(product.name)}</h1>
        <p class="product-detail__price">
          <span class="price${price < product.price ? " price--sale" : ""}">${formatPrice(price)}</span>
          ${
            product.oldPrice || price < product.price
              ? `<span class="price price--old">${formatPrice(product.oldPrice || product.price)}</span>`
              : ""
          }
        </p>
        <p class="product-detail__desc">${escapeHtml(product.description || "")}</p>
        <p class="stock-hint" data-stock-hint>${
          stockTotal <= 0
            ? "Rupture de stock"
            : stockTotal <= 5
              ? `Plus que ${stockTotal} en stock`
              : "En stock"
        }</p>

        <fieldset class="option-group">
          <legend>Taille <button type="button" class="linkish" data-open-size-guide>Guide</button></legend>
          <div class="option-pills" data-size-pills>
            ${sizes
              .map(
                (s) =>
                  `<button type="button" class="pill" data-size="${escapeHtml(s)}" ${
                    getStock(product, s) <= 0 ? "disabled" : ""
                  }>${escapeHtml(s)}</button>`
              )
              .join("")}
          </div>
        </fieldset>

        <fieldset class="option-group">
          <legend>Couleur</legend>
          <div class="option-pills option-pills--colors" data-color-pills>
            ${colors
              .map(
                (c) =>
                  `<button type="button" class="pill pill--color" data-color="${escapeHtml(c.name)}" title="${escapeHtml(c.name)}" style="--swatch:${escapeHtml(c.hex || "#888")}">
                    <span class="sr-only">${escapeHtml(c.name)}</span>
                  </button>`
              )
              .join("")}
          </div>
        </fieldset>

        <div class="qty-row">
          <label for="qty">Quantité</label>
          <div class="qty-control">
            <button type="button" data-qty-minus aria-label="Diminuer">−</button>
            <input type="number" id="qty" min="1" max="10" value="1" data-qty>
            <button type="button" data-qty-plus aria-label="Augmenter">+</button>
          </div>
        </div>

        <div class="product-detail__actions">
          <button type="button" class="btn btn--primary" data-add-cart>Ajouter au panier</button>
          <button type="button" class="btn btn--accent" data-order-now>Commander</button>
          <button type="button" class="btn btn--ghost" data-share>Partager</button>
        </div>

        ${
          Array.isArray(product.benefits) && product.benefits.length
            ? `<ul class="benefits">${product.benefits.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
            : ""
        }

        ${
          product.specs && Object.keys(product.specs).length
            ? `<details class="specs"><summary>Spécifications</summary>
                <dl>${Object.entries(product.specs)
                  .map(
                    ([k, v]) =>
                      `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`
                  )
                  .join("")}</dl>
              </details>`
            : ""
        }
      </div>
    </div>
    <section class="section">
      <h2 class="section__title">Vous aimerez aussi</h2>
      <div class="product-grid" data-related></div>
    </section>
    <dialog class="modal" data-size-guide-modal>
      <form method="dialog" class="modal__inner">
        <header><h2>Guide des tailles</h2><button value="close" aria-label="Fermer">×</button></header>
        <div class="size-guide-table-wrap">
          <table class="size-guide-table">
            <thead><tr><th>Taille</th><th>Poitrine (cm)</th><th>Taille (cm)</th><th>Hanches (cm)</th></tr></thead>
            <tbody>
              <tr><td>XS</td><td>84–88</td><td>68–72</td><td>88–92</td></tr>
              <tr><td>S</td><td>88–94</td><td>72–78</td><td>92–98</td></tr>
              <tr><td>M</td><td>94–100</td><td>78–84</td><td>98–104</td></tr>
              <tr><td>L</td><td>100–106</td><td>84–90</td><td>104–110</td></tr>
              <tr><td>XL</td><td>106–114</td><td>90–98</td><td>110–118</td></tr>
              <tr><td>XXL</td><td>114–122</td><td>98–106</td><td>118–126</td></tr>
            </tbody>
          </table>
        </div>
        <p><a href="size-guide.html">Voir le guide complet</a></p>
      </form>
    </dialog>`;

    let selectedSize = null;
    let selectedColor = null;

    // Gallery thumbs
    $$("[data-thumb]", root).forEach((btn) => {
      btn.addEventListener("click", () => {
        const main = $("[data-main-img]", root);
        main.src = btn.dataset.thumb;
        $$("[data-thumb]", root).forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
      });
    });

    $$("[data-size]", root).forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("[data-size]", root).forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        selectedSize = btn.dataset.size;
        const st = getStock(product, selectedSize);
        const hint = $("[data-stock-hint]", root);
        if (hint) {
          hint.textContent =
            st <= 0 ? "Rupture" : st <= 5 ? `Plus que ${st} en stock` : "En stock";
        }
      });
    });

    $$("[data-color]", root).forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("[data-color]", root).forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        selectedColor = btn.dataset.color;
      });
    });

    const qtyInput = $("[data-qty]", root);
    $("[data-qty-minus]", root)?.addEventListener("click", () => {
      qtyInput.value = Math.max(1, Number(qtyInput.value) - 1);
    });
    $("[data-qty-plus]", root)?.addEventListener("click", () => {
      qtyInput.value = Math.min(10, Number(qtyInput.value) + 1);
    });

    const modal = $("[data-size-guide-modal]", root);
    $("[data-open-size-guide]", root)?.addEventListener("click", () => modal?.showModal());

    const doAdd = () => {
      if (!selectedSize || !selectedColor) {
        toast("Choisissez une taille et une couleur.", "err");
        return false;
      }
      const qty = Math.max(1, Math.min(10, Number(qtyInput.value) || 1));
      const st = getStock(product, selectedSize);
      if (st < qty) {
        toast(`Stock insuffisant (${st} dispo).`, "err");
        return false;
      }
      addToCart({
        productId: product.id,
        name: product.name,
        price,
        size: selectedSize,
        color: selectedColor,
        qty,
        imageUrl: gallery[0],
      });
      toast("Ajouté au panier");
      return true;
    };

    $("[data-add-cart]", root)?.addEventListener("click", () => doAdd());
    $("[data-order-now]", root)?.addEventListener("click", () => {
      if (doAdd()) window.location.href = "panier.html";
    });
    $("[data-share]", root)?.addEventListener("click", async () => {
      try {
        const r = await shareProduct(product);
        if (r === "copied") toast("Lien copié");
      } catch {
        /* user cancelled */
      }
    });

    // Related
    const related = allProducts
      .filter((p) => p.id !== product.id && p.category === product.category)
      .slice(0, 4);
    const relatedEl = $("[data-related]", root);
    if (relatedEl) {
      relatedEl.innerHTML = related.map((p) => productCardHtml(p, flash)).join("");
    }
  } catch (err) {
    console.error(err);
    root.innerHTML = `<p class="empty-state">Erreur de chargement.</p>`;
  }
}

/* ─── Packs ─── */

async function initPacksPage() {
  const grid = $("[data-packs-grid]");
  if (!grid) return;
  grid.innerHTML = skeletonCards(4);
  try {
    const packs = await getPacks();
    grid.innerHTML = packs.length
      ? packs
          .map((pack) => {
            const img = resolveImageSync(pack);
            return `
          <article class="product-card pack-card">
            <a href="pack-detail.html?id=${encodeURIComponent(pack.id)}" class="product-card__media">
              <img src="${escapeHtml(img)}" alt="${escapeHtml(pack.name)}" loading="lazy">
            </a>
            <div class="product-card__body">
              <h3 class="product-card__title"><a href="pack-detail.html?id=${encodeURIComponent(pack.id)}">${escapeHtml(pack.name)}</a></h3>
              <p class="product-card__price"><span class="price">${formatPrice(pack.price)}</span></p>
            </div>
          </article>`;
          })
          .join("")
      : `<p class="empty-state">Aucun pack pour le moment.</p>`;
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p class="empty-state">Erreur de chargement des packs.</p>`;
  }
}

async function initPackDetail() {
  const root = $("[data-pack-detail]");
  if (!root) return;
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    root.innerHTML = `<p class="empty-state">Pack introuvable.</p>`;
    return;
  }
  try {
    const [pack, products] = await Promise.all([getPack(id), getProducts()]);
    if (!pack) {
      root.innerHTML = `<p class="empty-state">Pack introuvable.</p>`;
      return;
    }
    applySeo({
      title: `${pack.name} | GMCrossfit`,
      description: (pack.description || "").slice(0, 160),
      image: resolveImageSync(pack),
    });
    const included = (pack.productIds || [])
      .map((pid) => products.find((p) => p.id === pid))
      .filter(Boolean);

    root.innerHTML = `
      <div class="pack-detail">
        <div class="pack-detail__media">
          <img src="${escapeHtml(resolveImageSync(pack))}" alt="${escapeHtml(pack.name)}">
        </div>
        <div class="pack-detail__info">
          <h1>${escapeHtml(pack.name)}</h1>
          <p class="price">${formatPrice(pack.price)}</p>
          <p>${escapeHtml(pack.description || "")}</p>
          <p class="muted">Ajoutez chaque pièce du pack depuis sa fiche produit (taille & couleur).</p>
          <a class="btn btn--primary" href="produits.html">Voir la boutique</a>
        </div>
      </div>
      <section class="section">
        <h2 class="section__title">Inclus dans le pack</h2>
        <div class="product-grid">${included.map((p) => productCardHtml(p)).join("")}</div>
      </section>`;
  } catch (err) {
    console.error(err);
    root.innerHTML = `<p class="empty-state">Erreur de chargement.</p>`;
  }
}

/* ─── Cart page display ─── */

async function initCartPage() {
  const root = $("[data-cart-page]");
  if (!root) return;

  const { getCart, updateQty, removeFromCart, cartSubtotal } = await import("./cart.js");
  const { initCheckoutForm } = await import("./checkout.js");
  const settings = await getPublicSettings().catch(() => ({
    delivery: { fee: 30, freeThreshold: 500 },
  }));
  const fee = Number(settings.delivery?.fee) || 30;
  const freeThreshold = Number(settings.delivery?.freeThreshold) || 500;

  const listEl = $("[data-cart-list]", root);
  const summaryEl = $("[data-cart-summary]", root);

  const render = () => {
    const items = getCart();
    if (!items.length) {
      listEl.innerHTML = `<p class="empty-state">Votre panier est vide. <a href="produits.html">Continuer vos achats</a></p>`;
      if (summaryEl) summaryEl.hidden = true;
      return;
    }
    if (summaryEl) summaryEl.hidden = false;
    listEl.innerHTML = items
      .map(
        (item, i) => `
      <article class="cart-line" data-index="${i}">
        <img src="${escapeHtml(item.imageUrl || "assets/logo.jpg")}" alt="" width="80" height="100" loading="lazy">
        <div class="cart-line__info">
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.size)} · ${escapeHtml(item.color)}</p>
          <p class="price">${formatPrice(item.price)}</p>
        </div>
        <div class="qty-control">
          <button type="button" data-cart-minus="${i}" aria-label="Diminuer">−</button>
          <span>${item.qty}</span>
          <button type="button" data-cart-plus="${i}" aria-label="Augmenter">+</button>
        </div>
        <p class="cart-line__total">${formatPrice(item.price * item.qty)}</p>
        <button type="button" class="cart-line__remove" data-cart-remove="${i}" aria-label="Retirer">×</button>
      </article>`
      )
      .join("");

    const sub = cartSubtotal(items);
    const delivery = sub >= freeThreshold ? 0 : fee;
    const total = sub + delivery;
    const subEl = $("[data-subtotal]", root);
    const delEl = $("[data-delivery]", root);
    const totEl = $("[data-total]", root);
    if (subEl) subEl.textContent = formatPrice(sub);
    if (delEl) {
      delEl.textContent =
        delivery === 0 ? "Offerte" : formatPrice(delivery);
    }
    if (totEl) totEl.textContent = formatPrice(total);
    const hint = $("[data-free-delivery-hint]", root);
    if (hint) {
      hint.textContent =
        delivery === 0
          ? "Livraison offerte !"
          : `Plus que ${formatPrice(freeThreshold - sub)} pour la livraison offerte.`;
    }
  };

  listEl.addEventListener("click", (e) => {
    const minus = e.target.closest("[data-cart-minus]");
    const plus = e.target.closest("[data-cart-plus]");
    const remove = e.target.closest("[data-cart-remove]");
    if (minus) {
      const i = Number(minus.dataset.cartMinus);
      const items = getCart();
      updateQty(i, items[i].qty - 1);
      render();
    }
    if (plus) {
      const i = Number(plus.dataset.cartPlus);
      const items = getCart();
      updateQty(i, items[i].qty + 1);
      render();
    }
    if (remove) {
      removeFromCart(Number(remove.dataset.cartRemove));
      render();
    }
  });

  window.addEventListener("cart:updated", render);
  render();
  initCheckoutForm("[data-checkout-form]");
}

/* ─── Contact WhatsApp ─── */

async function initContact() {
  const wa = $("[data-contact-whatsapp]");
  if (!wa) return;
  try {
    const s = await getPublicSettings();
    if (s.whatsappNumber) {
      const digits = String(s.whatsappNumber).replace(/[^\d]/g, "");
      wa.href = `https://wa.me/${digits}?text=${encodeURIComponent("Bonjour GMCrossfit !")}`;
    }
  } catch {
    /* ignore */
  }
}

/* ─── Boot ─── */

document.addEventListener("DOMContentLoaded", () => {
  initTracking();
  initHome();
  initProductsPage();
  initProductDetail();
  initPacksPage();
  initPackDetail();
  initCartPage();
  initContact();

  // Flash sale page
  if ($("[data-flash-sale]")) {
    import("./flashsale.js").then((m) => m.initFlashSalePage());
  }
});
