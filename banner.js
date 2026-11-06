/**
 * Site-wide promo banner from settings/public.banner
 */
import { getPublicSettings } from "./data-cache.js";

/**
 * Render the top banner if active.
 * @param {string} [selector='[data-site-banner]']
 */
export async function initBanner(selector = "[data-site-banner]") {
  const el = document.querySelector(selector);
  if (!el) return;

  try {
    const settings = await getPublicSettings();
    const banner = settings.banner || {};
    if (!banner.active || !banner.text) {
      el.hidden = true;
      return;
    }

    el.hidden = false;
    el.classList.add("site-banner");
    const text = document.createElement("p");
    text.className = "site-banner__text";
    text.textContent = banner.text;

    el.replaceChildren();
    if (banner.link) {
      const a = document.createElement("a");
      a.href = banner.link;
      a.className = "site-banner__link";
      a.appendChild(text);
      el.appendChild(a);
    } else {
      el.appendChild(text);
    }

    if (banner.dismissible !== false) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "site-banner__close";
      btn.setAttribute("aria-label", "Fermer");
      btn.textContent = "×";
      btn.addEventListener("click", () => {
        el.hidden = true;
        try {
          sessionStorage.setItem("gmc_banner_dismissed", "1");
        } catch {
          /* ignore */
        }
      });
      el.appendChild(btn);
    }

    if (sessionStorage.getItem("gmc_banner_dismissed") === "1") {
      el.hidden = true;
    }
  } catch (err) {
    console.warn("[banner]", err);
    el.hidden = true;
  }
}

// Auto-init when imported as module on pages that include the slot
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector("[data-site-banner]")) {
      initBanner();
    }
  });
}
