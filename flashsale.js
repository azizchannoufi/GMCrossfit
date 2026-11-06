/**
 * Flash sale countdown from settings/public.flashSale
 */
import { getPublicSettings, getProducts } from "./data-cache.js";
import { resolveImageSync } from "./image-resolve.js";

/**
 * Parse date from ISO string or Firestore-serialized value.
 * @param {string|number|Date} value
 */
function toMs(value) {
  if (!value) return NaN;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  const t = Date.parse(value);
  return t;
}

/**
 * @param {object} flashSale
 */
export function isFlashSaleActive(flashSale) {
  if (!flashSale || !flashSale.active) return false;
  const now = Date.now();
  const start = toMs(flashSale.startAt);
  const end = toMs(flashSale.endAt);
  if (!Number.isFinite(end)) return false;
  if (Number.isFinite(start) && now < start) return false;
  return now <= end;
}

/**
 * Format remaining ms as HH:MM:SS or Dd HH:MM:SS
 * @param {number} ms
 */
export function formatCountdown(ms) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (days > 0) return `${days}j ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

/**
 * Mount a live countdown into an element.
 * @param {HTMLElement} el
 * @param {number} endMs
 * @param {() => void} [onEnd]
 */
export function mountCountdown(el, endMs, onEnd) {
  const tick = () => {
    const remaining = endMs - Date.now();
    el.textContent = formatCountdown(remaining);
    el.setAttribute("datetime", new Date(endMs).toISOString());
    if (remaining <= 0) {
      clearInterval(timer);
      el.textContent = "Terminé";
      onEnd?.();
    }
  };
  tick();
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}

/**
 * Apply flash discount display price.
 * @param {number} price
 * @param {object} flashSale
 * @param {string} productId
 */
export function flashPrice(price, flashSale, productId) {
  if (!isFlashSaleActive(flashSale)) return price;
  const ids = Array.isArray(flashSale.productIds) ? flashSale.productIds : [];
  if (ids.length && !ids.includes(productId)) return price;
  const pct = Number(flashSale.discountPercent) || 0;
  if (pct <= 0) return price;
  return Math.round(price * (1 - pct / 100) * 100) / 100;
}

/**
 * Init flash sale page / home teaser.
 */
export async function initFlashSalePage() {
  const root = document.querySelector("[data-flash-sale]");
  if (!root) return;

  const settings = await getPublicSettings();
  const flash = settings.flashSale || {};
  const countdownEl = root.querySelector("[data-flash-countdown]");
  const titleEl = root.querySelector("[data-flash-title]");
  const grid = root.querySelector("[data-flash-grid]");
  const inactiveEl = root.querySelector("[data-flash-inactive]");

  if (titleEl && flash.title) titleEl.textContent = flash.title;

  if (!isFlashSaleActive(flash)) {
    if (inactiveEl) inactiveEl.hidden = false;
    if (countdownEl) countdownEl.textContent = "—";
    if (grid) grid.innerHTML = "";
    return;
  }

  if (inactiveEl) inactiveEl.hidden = true;
  const endMs = toMs(flash.endAt);
  if (countdownEl && Number.isFinite(endMs)) {
    mountCountdown(countdownEl, endMs, () => {
      if (inactiveEl) inactiveEl.hidden = false;
    });
  }

  if (!grid) return;
  const products = await getProducts();
  const ids = Array.isArray(flash.productIds) ? flash.productIds : [];
  const list =
    ids.length > 0
      ? products.filter((p) => ids.includes(p.id))
      : products.filter((p) => p.isHot);

  const pct = Number(flash.discountPercent) || 0;
  grid.innerHTML = list
    .map((p) => {
      const img = resolveImageSync(p);
      const sale = flashPrice(p.price, flash, p.id);
      return `
      <article class="product-card">
        <a href="produit-detail.html?id=${encodeURIComponent(p.id)}" class="product-card__media">
          <img src="${img}" alt="${escapeAttr(p.name)}" loading="lazy" width="400" height="500">
          <span class="badge badge--hot">-${pct}%</span>
        </a>
        <div class="product-card__body">
          <h3 class="product-card__title"><a href="produit-detail.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a></h3>
          <p class="product-card__price">
            <span class="price price--sale">${sale} MAD</span>
            <span class="price price--old">${p.price} MAD</span>
          </p>
        </div>
      </article>`;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

/**
 * Home page mini countdown.
 */
export async function initFlashTeaser(selector = "[data-flash-teaser]") {
  const el = document.querySelector(selector);
  if (!el) return;
  try {
    const settings = await getPublicSettings();
    const flash = settings.flashSale || {};
    if (!isFlashSaleActive(flash)) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const title = el.querySelector("[data-flash-teaser-title]");
    const cd = el.querySelector("[data-flash-teaser-countdown]");
    if (title) title.textContent = flash.title || "Vente Flash";
    const endMs = toMs(flash.endAt);
    if (cd && Number.isFinite(endMs)) mountCountdown(cd, endMs);
  } catch (err) {
    console.warn("[flashsale teaser]", err);
    el.hidden = true;
  }
}
