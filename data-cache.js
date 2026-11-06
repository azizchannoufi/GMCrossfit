/**
 * Firestore read cache backed by sessionStorage (TTL 5 minutes).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getFirebase } from "./firebase-init.js";

const TTL_MS = 5 * 60 * 1000;
const PREFIX = "gmc_cache_";

/**
 * @param {string} key
 * @returns {{ data: any, ts: number } | null}
 */
function readCache(key) {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > TTL_MS) {
      sessionStorage.removeItem(PREFIX + key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @param {any} data
 */
function writeCache(key, data) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // Quota exceeded — ignore
  }
}

/** Clear all GMCrossfit session caches (useful after admin edits in same browser). */
export function clearDataCache() {
  const keys = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => sessionStorage.removeItem(k));
}

/**
 * Serialize Firestore timestamps to ISO strings for sessionStorage.
 */
function serializeDoc(id, data) {
  const out = { id, ...data };
  for (const key of Object.keys(out)) {
    const val = out[key];
    if (val && typeof val === "object" && typeof val.toDate === "function") {
      out[key] = val.toDate().toISOString();
    }
  }
  return out;
}

/**
 * Fetch all documents from a collection (optionally ordered).
 * @param {string} collectionName
 * @param {{ orderField?: string, orderDir?: 'asc'|'desc', force?: boolean }} [opts]
 */
export async function getCachedCollection(collectionName, opts = {}) {
  const cacheKey = `col_${collectionName}_${opts.orderField || ""}_${opts.orderDir || ""}`;
  if (!opts.force) {
    const hit = readCache(cacheKey);
    if (hit) return hit.data;
  }

  const { db } = getFirebase();
  let q = collection(db, collectionName);
  if (opts.orderField) {
    q = query(collection(db, collectionName), orderBy(opts.orderField, opts.orderDir || "asc"));
  }
  const snap = await getDocs(q);
  const data = snap.docs.map((d) => serializeDoc(d.id, d.data()));
  writeCache(cacheKey, data);
  return data;
}

/**
 * Fetch a single document by id.
 * @param {string} collectionName
 * @param {string} id
 * @param {{ force?: boolean }} [opts]
 */
export async function getCachedDoc(collectionName, id, opts = {}) {
  const cacheKey = `doc_${collectionName}_${id}`;
  if (!opts.force) {
    const hit = readCache(cacheKey);
    if (hit) return hit.data;
  }

  const { db } = getFirebase();
  const snap = await getDoc(doc(db, collectionName, id));
  if (!snap.exists()) return null;
  const data = serializeDoc(snap.id, snap.data());
  writeCache(cacheKey, data);
  return data;
}

/** Convenience helpers */
export async function getProducts(force = false) {
  return getCachedCollection("products", { orderField: "createdAt", orderDir: "desc", force });
}

export async function getProduct(id, force = false) {
  return getCachedDoc("products", id, { force });
}

export async function getCategories(force = false) {
  return getCachedCollection("categories", { orderField: "order", orderDir: "asc", force });
}

export async function getPacks(force = false) {
  return getCachedCollection("packs", { force });
}

export async function getPack(id, force = false) {
  return getCachedDoc("packs", id, { force });
}

export async function getPublicSettings(force = false) {
  const data = await getCachedDoc("settings", "public", { force });
  return (
    data || {
      whatsappNumber: "",
      delivery: { fee: 30, freeThreshold: 500 },
      banner: { active: false },
      flashSale: { active: false },
      promos: [],
    }
  );
}
