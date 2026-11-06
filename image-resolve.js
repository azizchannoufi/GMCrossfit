/**
 * Resolve product / pack / category image URLs.
 * Prefer stored download URLs (imageUrl); fall back to Firebase Storage path.
 */
import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getFirebase } from "./firebase-init.js";

const FALLBACK = "assets/logo.jpg";
const urlMemo = new Map();

/**
 * Resolve a single image hint to a usable URL.
 * @param {{ imageUrl?: string, storagePath?: string, images?: Array }} entity
 * @param {'primary'|'hover'|number} [which='primary']
 * @returns {Promise<string>}
 */
export async function resolveImage(entity, which = "primary") {
  if (!entity) return FALLBACK;

  if (which === "hover" && entity.imageHover) {
    return entity.imageHover;
  }

  if (typeof which === "number" && Array.isArray(entity.images)) {
    const entry = entity.images[which];
    if (!entry) return resolveImage(entity, "primary");
    if (typeof entry === "string") return entry || FALLBACK;
    if (entry.url) return entry.url;
    if (entry.storagePath) return resolveStoragePath(entry.storagePath);
  }

  if (entity.imageUrl) return entity.imageUrl;

  if (Array.isArray(entity.images) && entity.images.length) {
    const first = entity.images[0];
    if (typeof first === "string" && first) return first;
    if (first?.url) return first.url;
    if (first?.storagePath) return resolveStoragePath(first.storagePath);
  }

  if (entity.storagePath) {
    return resolveStoragePath(entity.storagePath);
  }

  return FALLBACK;
}

/**
 * Sync helper when you already have imageUrl (no Storage round-trip).
 * @param {object} entity
 * @returns {string}
 */
export function resolveImageSync(entity) {
  if (!entity) return FALLBACK;
  if (entity.imageUrl) return entity.imageUrl;
  if (Array.isArray(entity.images) && entity.images.length) {
    const first = entity.images[0];
    if (typeof first === "string" && first) return first;
    if (first?.url) return first.url;
  }
  return FALLBACK;
}

/**
 * @param {string} storagePath
 * @returns {Promise<string>}
 */
export async function resolveStoragePath(storagePath) {
  if (!storagePath) return FALLBACK;
  if (urlMemo.has(storagePath)) return urlMemo.get(storagePath);

  try {
    const { storage } = getFirebase();
    const url = await getDownloadURL(ref(storage, storagePath));
    urlMemo.set(storagePath, url);
    return url;
  } catch (err) {
    console.warn("[image-resolve] Storage URL failed:", storagePath, err.message);
    return FALLBACK;
  }
}

/**
 * Build gallery list for a product (primary + images[] + hover).
 * @param {object} product
 * @returns {Promise<string[]>}
 */
export async function resolveGallery(product) {
  const urls = [];
  const primary = await resolveImage(product, "primary");
  urls.push(primary);

  if (Array.isArray(product.images)) {
    for (let i = 0; i < product.images.length; i++) {
      const u = await resolveImage(product, i);
      if (u && !urls.includes(u)) urls.push(u);
    }
  }

  if (product.imageHover && !urls.includes(product.imageHover)) {
    urls.push(product.imageHover);
  }

  return urls.length ? urls : [FALLBACK];
}

export { FALLBACK as IMAGE_FALLBACK };
