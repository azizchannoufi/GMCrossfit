/**
 * Web Components: <app-header> and <app-footer>
 */
import { cartCount } from "./cart.js";

const THEME_KEY = "gmc_theme";

function currentPage() {
  const file = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (!file || file === "/") return "index.html";
  return file;
}

function navLink(href, label, page) {
  const active = page === href ? ' aria-current="page" class="is-active"' : "";
  return `<a href="${href}"${active}>${label}</a>`;
}

class AppHeader extends HTMLElement {
  connectedCallback() {
    const page = currentPage();
    this.innerHTML = `
      <header class="site-header">
        <div class="site-header__inner">
          <button type="button" class="nav-toggle" aria-label="Menu" aria-expanded="false" data-nav-toggle>
            <span></span><span></span><span></span>
          </button>
          <a href="index.html" class="brand" aria-label="GMCrossfit accueil">
            <img src="assets/logo.jpg" alt="" class="brand__logo" width="40" height="40">
            <span class="brand__name">GMCrossfit</span>
          </a>
          <nav class="site-nav" data-site-nav>
            ${navLink("index.html", "Accueil", page)}
            ${navLink("produits.html", "Boutique", page)}
            ${navLink("packs.html", "Packs", page)}
            ${navLink("venteflash.html", "Flash", page)}
            ${navLink("apropos.html", "À propos", page)}
            ${navLink("contact.html", "Contact", page)}
          </nav>
          <div class="site-header__actions">
            <button type="button" class="theme-toggle" data-theme-toggle aria-label="Changer le thème">
              <span class="theme-toggle__icon" aria-hidden="true"></span>
            </button>
            <a href="panier.html" class="cart-btn" aria-label="Panier">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M6 6L5 3H2"/>
              </svg>
              <span class="cart-badge" data-cart-badge hidden>0</span>
            </a>
          </div>
        </div>
        <div class="site-nav-drawer" data-nav-drawer hidden>
          <nav>
            ${navLink("index.html", "Accueil", page)}
            ${navLink("produits.html", "Boutique", page)}
            ${navLink("packs.html", "Packs", page)}
            ${navLink("venteflash.html", "Vente Flash", page)}
            ${navLink("apropos.html", "À propos", page)}
            ${navLink("contact.html", "Contact", page)}
            ${navLink("size-guide.html", "Guide des tailles", page)}
            ${navLink("panier.html", "Panier", page)}
          </nav>
        </div>
      </header>
    `;

    this._bind();
    this._updateBadge();
    window.addEventListener("cart:updated", () => this._updateBadge());
  }

  _bind() {
    const toggle = this.querySelector("[data-nav-toggle]");
    const drawer = this.querySelector("[data-nav-drawer]");
    toggle?.addEventListener("click", () => {
      const open = drawer.hasAttribute("hidden");
      if (open) {
        drawer.removeAttribute("hidden");
        toggle.setAttribute("aria-expanded", "true");
        document.body.classList.add("nav-open");
      } else {
        drawer.setAttribute("hidden", "");
        toggle.setAttribute("aria-expanded", "false");
        document.body.classList.remove("nav-open");
      }
    });

    const themeBtn = this.querySelector("[data-theme-toggle]");
    themeBtn?.addEventListener("click", () => {
      const html = document.documentElement;
      const next = html.getAttribute("data-theme") === "light" ? "dark" : "light";
      html.setAttribute("data-theme", next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
    });
  }

  _updateBadge() {
    const badge = this.querySelector("[data-cart-badge]");
    if (!badge) return;
    const n = cartCount();
    badge.textContent = String(n);
    badge.hidden = n === 0;
  }
}

class AppFooter extends HTMLElement {
  connectedCallback() {
    const year = new Date().getFullYear();
    this.innerHTML = `
      <footer class="site-footer">
        <div class="site-footer__grid">
          <div class="site-footer__brand">
            <a href="index.html" class="brand brand--footer">
              <img src="assets/logo.jpg" alt="" width="36" height="36">
              <span class="brand__name">GMCrossfit</span>
            </a>
            <p>Sportswear CrossFit premium. Performance. Attitude. Qualité.</p>
          </div>
          <div>
            <h3>Boutique</h3>
            <ul>
              <li><a href="produits.html">Tous les produits</a></li>
              <li><a href="packs.html">Packs</a></li>
              <li><a href="venteflash.html">Vente Flash</a></li>
              <li><a href="size-guide.html">Guide des tailles</a></li>
            </ul>
          </div>
          <div>
            <h3>Aide</h3>
            <ul>
              <li><a href="apropos.html">À propos</a></li>
              <li><a href="contact.html">Contact</a></li>
              <li><a href="panier.html">Panier</a></li>
            </ul>
          </div>
          <div>
            <h3>Suivez-nous</h3>
            <p class="site-footer__social">
              <a href="https://instagram.com/" target="_blank" rel="noopener noreferrer">Instagram</a>
              <a href="#" data-footer-whatsapp target="_blank" rel="noopener noreferrer">WhatsApp</a>
            </p>
          </div>
        </div>
        <p class="site-footer__copy">© ${year} GMCrossfit. Tous droits réservés.</p>
      </footer>
    `;

    // Wire WhatsApp from settings when available
    import("./data-cache.js")
      .then(({ getPublicSettings }) => getPublicSettings())
      .then((s) => {
        const a = this.querySelector("[data-footer-whatsapp]");
        if (a && s.whatsappNumber) {
          a.href = `https://wa.me/${String(s.whatsappNumber).replace(/[^\d]/g, "")}`;
        }
      })
      .catch(() => {});
  }
}

// Theme bootstrap before paint (also called from inline head snippet)
export function initTheme() {
  let theme = "dark";
  try {
    theme = localStorage.getItem(THEME_KEY) || "dark";
  } catch {
    theme = "dark";
  }
  document.documentElement.setAttribute("data-theme", theme);
}

initTheme();

if (!customElements.get("app-header")) {
  customElements.define("app-header", AppHeader);
}
if (!customElements.get("app-footer")) {
  customElements.define("app-footer", AppFooter);
}
