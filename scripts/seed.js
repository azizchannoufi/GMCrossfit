/**
 * Seed Firestore with sample catalog data (12 products, 5 categories, 2 packs, settings).
 *
 * Production:
 *   Place serviceAccountKey.json at project root, then:
 *   node scripts/seed.js
 *
 * Emulator:
 *   $env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
 *   $env:GOOGLE_CLOUD_PROJECT="gmcrossfit-demo"
 *   node scripts/seed.js
 */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const keyPath = path.join(__dirname, "..", "serviceAccountKey.json");

if (usingEmulator) {
  admin.initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT || "gmcrossfit-demo" });
  console.log("Seeding Firestore Emulator at", process.env.FIRESTORE_EMULATOR_HOST);
} else if (fs.existsSync(keyPath)) {
  admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
} else {
  console.error("Need serviceAccountKey.json or FIRESTORE_EMULATOR_HOST.");
  process.exit(1);
}

const db = admin.firestore();

/** Unsplash fitness / apparel placeholders (hotlink OK for demo seed). */
const IMG = {
  tee: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80",
  tee2: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&q=80",
  tank: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80",
  tank2: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&q=80",
  shorts: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=800&q=80",
  shorts2: "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=800&q=80",
  leggings: "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=800&q=80",
  leggings2: "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=800&q=80",
  hoodie: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80",
  hoodie2: "https://images.unsplash.com/photo-1578587018452-892baca089d1?w=800&q=80",
  cap: "https://images.unsplash.com/photo-1588850561407-ed78ebb49593?w=800&q=80",
  socks: "https://images.unsplash.com/photo-1586350977771-b3b0ead52615?w=800&q=80",
  pack1: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80",
  pack2: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80",
  catTee: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80",
  catTank: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&q=80",
  catShorts: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=600&q=80",
  catLeg: "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=600&q=80",
  catHood: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&q=80",
};

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const stockAll = () =>
  Object.fromEntries(SIZES.map((s) => [s, s === "XXL" ? 4 : 12]));

const COLORS_BW = [
  { name: "Noir", hex: "#111111" },
  { name: "Blanc", hex: "#f5f5f5" },
];
const COLORS_RED = [
  { name: "Noir", hex: "#111111" },
  { name: "Rouge", hex: "#E10600" },
];

function product(id, data) {
  return {
    id,
    ...data,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

const products = [
  product("tee-box-black", {
    name: "T-Shirt Box Black",
    description: "T-shirt coupe athlétique, coton stretch respirant. Logo GM ton sur ton.",
    price: 249,
    oldPrice: 299,
    category: "T-shirts",
    gender: "unisex",
    imageUrl: IMG.tee,
    imageHover: IMG.tee2,
    images: [IMG.tee, IMG.tee2],
    sizes: SIZES,
    colors: COLORS_BW,
    stockBySize: stockAll(),
    isNew: true,
    isHot: true,
    benefits: ["Séchage rapide", "Coupe fitted", "Logo brodé"],
    specs: { Matière: "92% coton / 8% élasthanne", Entretien: "30°C" },
  }),
  product("tee-wod-red", {
    name: "T-Shirt WOD Red",
    description: "Accent rouge électrique. Idéal pour les sessions haute intensité.",
    price: 259,
    category: "T-shirts",
    gender: "men",
    imageUrl: IMG.tee2,
    imageHover: IMG.tee,
    images: [IMG.tee2],
    sizes: SIZES,
    colors: COLORS_RED,
    stockBySize: stockAll(),
    isNew: false,
    isHot: true,
    benefits: ["Anti-odeurs", "Col renforcé"],
    specs: { Matière: "Polyester technique" },
  }),
  product("tank-beast", {
    name: "Tank Beast Mode",
    description: "Débardeur oversized ouvert sur les côtés pour une liberté totale.",
    price: 229,
    category: "Débardeurs",
    gender: "men",
    imageUrl: IMG.tank,
    imageHover: IMG.tank2,
    images: [IMG.tank, IMG.tank2],
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: COLORS_BW,
    stockBySize: { S: 8, M: 14, L: 14, XL: 10, XXL: 5 },
    isNew: true,
    isHot: false,
    benefits: ["Aisselles larges", "Drop armhole"],
    specs: { Coupe: "Oversized" },
  }),
  product("tank-flame", {
    name: "Tank Flame Women",
    description: "Débardeur femme coupe crop, maintien léger.",
    price: 219,
    category: "Débardeurs",
    gender: "women",
    imageUrl: IMG.tank2,
    imageHover: IMG.tank,
    images: [IMG.tank2],
    sizes: ["XS", "S", "M", "L", "XL"],
    colors: COLORS_RED,
    stockBySize: { XS: 6, S: 10, M: 12, L: 8, XL: 4 },
    isNew: true,
    isHot: true,
    benefits: ["Crop fit", "Tissu soft-touch"],
    specs: {},
  }),
  product("shorts-rope", {
    name: "Shorts Jump Rope",
    description: "Short 2-en-1 avec compression interne. Poche zippée.",
    price: 279,
    oldPrice: 320,
    category: "Shorts",
    gender: "men",
    imageUrl: IMG.shorts,
    imageHover: IMG.shorts2,
    images: [IMG.shorts],
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: COLORS_BW,
    stockBySize: { S: 10, M: 15, L: 15, XL: 8, XXL: 3 },
    isNew: false,
    isHot: true,
    benefits: ["Liner compression", "Séchage rapide"],
    specs: { Longueur: "18 cm" },
  }),
  product("shorts-split", {
    name: "Shorts Split Women",
    description: "Short fendu latéral, taille haute confortable.",
    price: 249,
    category: "Shorts",
    gender: "women",
    imageUrl: IMG.shorts2,
    imageHover: IMG.shorts,
    images: [IMG.shorts2],
    sizes: ["XS", "S", "M", "L", "XL"],
    colors: [{ name: "Noir", hex: "#111" }, { name: "Gris", hex: "#666" }],
    stockBySize: { XS: 5, S: 9, M: 11, L: 7, XL: 4 },
    isNew: true,
    isHot: false,
    benefits: ["Taille haute", "Split side"],
    specs: {},
  }),
  product("leg-power", {
    name: "Leggings Power",
    description: "Leggings compression, poche latérale pour téléphone.",
    price: 349,
    category: "Leggings",
    gender: "women",
    imageUrl: IMG.leggings,
    imageHover: IMG.leggings2,
    images: [IMG.leggings, IMG.leggings2],
    sizes: ["XS", "S", "M", "L", "XL"],
    colors: COLORS_BW,
    stockBySize: { XS: 7, S: 12, M: 14, L: 10, XL: 6 },
    isNew: false,
    isHot: true,
    benefits: ["Compression", "Anti-transparent"],
    specs: { Matière: "Nylon / spandex" },
  }),
  product("leg-camo", {
    name: "Leggings Camo Soft",
    description: "Motif camo discret, second-skin feel.",
    price: 359,
    category: "Leggings",
    gender: "women",
    imageUrl: IMG.leggings2,
    imageHover: IMG.leggings,
    images: [IMG.leggings2],
    sizes: ["XS", "S", "M", "L", "XL"],
    colors: [{ name: "Camo", hex: "#3a4a32" }],
    stockBySize: { XS: 4, S: 8, M: 10, L: 6, XL: 3 },
    isNew: true,
    isHot: false,
    benefits: ["Soft touch", "Squat proof"],
    specs: {},
  }),
  product("hood-recovery", {
    name: "Hoodie Recovery",
    description: "Hoodie oversize molleton lourd pour le warm-up et le cool-down.",
    price: 449,
    oldPrice: 499,
    category: "Hoodies",
    gender: "unisex",
    imageUrl: IMG.hoodie,
    imageHover: IMG.hoodie2,
    images: [IMG.hoodie, IMG.hoodie2],
    sizes: SIZES,
    colors: COLORS_BW,
    stockBySize: stockAll(),
    isNew: true,
    isHot: true,
    benefits: ["Molleton 400gsm", "Poche kangourou"],
    specs: { Coupe: "Oversized" },
  }),
  product("hood-zip", {
    name: "Hoodie Zip Track",
    description: "Zip intégral, capuche doublée, idéal transition box → rue.",
    price: 469,
    category: "Hoodies",
    gender: "unisex",
    imageUrl: IMG.hoodie2,
    imageHover: IMG.hoodie,
    images: [IMG.hoodie2],
    sizes: SIZES,
    colors: COLORS_RED,
    stockBySize: stockAll(),
    isNew: false,
    isHot: false,
    benefits: ["Zip YKK", "Poignets côtes"],
    specs: {},
  }),
  product("acc-cap", {
    name: "Casquette Snapback GM",
    description: "Snapback brodé GMCrossfit. One size.",
    price: 149,
    category: "Accessoires",
    gender: "unisex",
    imageUrl: IMG.cap,
    images: [IMG.cap],
    sizes: ["M"],
    colors: COLORS_BW,
    stockBySize: { M: 40 },
    isNew: true,
    isHot: false,
    benefits: ["Broderie 3D", "Réglable"],
    specs: { Taille: "Unique" },
  }),
  product("acc-socks", {
    name: "Chaussettes Grip Crew",
    description: "Crew socks anti-glisse pour les lifts et les rope doubles.",
    price: 99,
    category: "Accessoires",
    gender: "unisex",
    imageUrl: IMG.socks,
    images: [IMG.socks],
    sizes: ["S", "M", "L"],
    colors: COLORS_RED,
    stockBySize: { S: 20, M: 30, L: 20 },
    isNew: false,
    isHot: true,
    benefits: ["Grip semelle", "Pack performance"],
    specs: {},
  }),
];

const categories = [
  { id: "tshirts", name: "T-shirts", imageUrl: IMG.catTee, order: 1 },
  { id: "tanks", name: "Débardeurs", imageUrl: IMG.catTank, order: 2 },
  { id: "shorts", name: "Shorts", imageUrl: IMG.catShorts, order: 3 },
  { id: "leggings", name: "Leggings", imageUrl: IMG.catLeg, order: 4 },
  { id: "hoodies", name: "Hoodies", imageUrl: IMG.catHood, order: 5 },
];

const packs = [
  {
    id: "full-wod",
    name: "Full WOD Outfit",
    description: "T-shirt Box Black + Shorts Jump Rope + Chaussettes Grip. Prêt pour la box.",
    price: 549,
    productIds: ["tee-box-black", "shorts-rope", "acc-socks"],
    imageUrl: IMG.pack1,
  },
  {
    id: "recovery-set",
    name: "Recovery Set",
    description: "Hoodie Recovery + Leggings Power. Warm-up & cool-down premium.",
    price: 729,
    productIds: ["hood-recovery", "leg-power"],
    imageUrl: IMG.pack2,
  },
];

async function seed() {
  const batch = db.batch();

  for (const cat of categories) {
    const { id, ...data } = cat;
    batch.set(db.collection("categories").doc(id), data);
  }

  for (const p of products) {
    const { id, ...data } = p;
    batch.set(db.collection("products").doc(id), data);
  }

  for (const pack of packs) {
    const { id, ...data } = pack;
    batch.set(db.collection("packs").doc(id), data);
  }

  const now = Date.now();
  batch.set(db.collection("settings").doc("public"), {
    whatsappNumber: "212600000000",
    delivery: { fee: 30, freeThreshold: 500 },
    banner: {
      active: true,
      text: "Livraison offerte dès 500 MAD — Paiement à la livraison",
      link: "produits.html",
      dismissible: true,
    },
    flashSale: {
      active: true,
      title: "Flash Drop −20%",
      discountPercent: 20,
      startAt: new Date(now - 3600_000).toISOString(),
      endAt: new Date(now + 7 * 24 * 3600_000).toISOString(),
      productIds: ["tee-box-black", "hood-recovery", "shorts-rope", "leg-power"],
    },
    promos: [
      { code: "WOD10", type: "percent", value: 10, active: true },
      { code: "GM50", type: "fixed", value: 50, active: true },
    ],
  });

  await batch.commit();
  console.log(
    `Seeded ${products.length} products, ${categories.length} categories, ${packs.length} packs + settings/public`
  );
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
