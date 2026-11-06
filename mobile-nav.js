/**
 * Sticky bottom mobile navigation.
 */
import { cartCount } from "./cart.js";

function currentFile() {
  return (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
}

const ITEMS = [
  { href: "index.html", label: "Accueil", icon: "home" },
  { href: "produits.html", label: "Shop", icon: "shop" },
  { href: "packs.html", label: "Packs", icon: "pack" },
  { href: "panier.html", label: "Panier", icon: "cart" },
  { href: "contact.html", label: "Contact", icon: "contact" },
];

const ICONS = {
  home: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>`,
  shop: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="1"/><path d="M8 7V5a4 4 0 018 0v2"/></svg>`,
  pack: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>`,
  cart: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M6 6L5 3H2"/></svg>`,
  contact: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.6a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.5-1.1a2 2 0 012.1-.4c.8.3 1.7.5 2.6.6a2 2 0 011.7 2z"/></svg>`,
};

export function initMobileNav() {
  if (document.querySelector(".mobile-nav")) return;

  const page = currentFile();
  const nav = document.createElement("nav");
  nav.className = "mobile-nav";
  nav.setAttribute("aria-label", "Navigation mobile");

  nav.innerHTML = ITEMS.map((item) => {
    const active = page === item.href ? " is-active" : "";
    const badge =
      item.icon === "cart"
        ? `<span class="mobile-nav__badge" data-mobile-cart-badge hidden>0</span>`
        : "";
    return `<a href="${item.href}" class="mobile-nav__item${active}">
      <span class="mobile-nav__icon">${ICONS[item.icon]}${badge}</span>
      <span class="mobile-nav__label">${item.label}</span>
    </a>`;
  }).join("");

  document.body.appendChild(nav);
  document.body.classList.add("has-mobile-nav");
  updateBadge();
  window.addEventListener("cart:updated", updateBadge);
}

function updateBadge() {
  const badge = document.querySelector("[data-mobile-cart-badge]");
  if (!badge) return;
  const n = cartCount();
  badge.textContent = String(n);
  badge.hidden = n === 0;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMobileNav);
  } else {
    initMobileNav();
  }
}
