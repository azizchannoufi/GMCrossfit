# GMCrossfit

Production-ready CrossFit sportswear e-commerce: vanilla HTML/CSS/JS storefront + Firebase (Firestore, Auth, Storage, Functions, Hosting).

Checkout: cart → callable `createOrder` (server prices + stock transaction) → WhatsApp `wa.me` link. Telegram alert via `notifyOrder` (Secret Manager).

## Stack

| Layer | Tech |
|-------|------|
| Storefront | HTML5, CSS3, ES modules (no React, no bundler) |
| Firebase JS | v10.8.0 CDN |
| Cart | `localStorage` key `gmc_cart` |
| Catalog cache | `sessionStorage`, TTL 5 min |
| Backend | Cloud Functions Node 20, 2nd gen, `europe-west1` |
| Admin | Email/Password + custom claim `admin: true` |

## Quick start — UI only (`live-server`)

Useful for layout work without emulators (Firestore calls will fail until config/emulators are up):

```bash
npm run serve:ui
# → http://127.0.0.1:5500
```

## Quick start — full local stack (emulators)

1. Install tools:

```bash
npm install
cd functions && npm install && cd ..
npm install -g firebase-tools   # if needed
firebase login
```

2. Put your web config in `admin/firebase-config.js` (or keep placeholders; emulators mainly need `projectId`).

3. Start emulators (Hosting + Firestore + Functions + Auth + Storage):

```bash
firebase emulators:start
```

- Storefront: http://127.0.0.1:5000  
- Emulator UI: http://127.0.0.1:4000  
- On `localhost`, `firebase-init.js` auto-connects to emulators.

4. Seed data (PowerShell):

```powershell
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
$env:GOOGLE_CLOUD_PROJECT="gmcrossfit-demo"
node scripts/seed.js
```

5. Create an admin user in Emulator UI → Authentication, then:

```powershell
$env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
$env:GOOGLE_CLOUD_PROJECT="gmcrossfit-demo"
node scripts/set-admin-claim.js admin@test.com
```

6. Open http://127.0.0.1:5000 and http://127.0.0.1:5000/admin/login.html

## Project structure

```
gmcrossfit/
├── index.html … 404.html     # Storefront pages (FR)
├── style.css, components.js, mobile-nav.js
├── firebase-init.js, data-cache.js, image-resolve.js
├── cart.js, checkout.js, script.js
├── banner.js, flashsale.js, seo.js
├── admin/                    # Guarded admin panel
├── functions/                # createOrder, notifyOrder, productShare, sitemap, trackEvent
├── scripts/seed.js, set-admin-claim.js
├── firestore.rules, storage.rules, firebase.json
├── FIREBASE_SETUP.md
└── assets/logo.jpg
```

## End-to-end order test

1. Seed catalog + settings (WhatsApp number in `settings/public`).
2. Deploy or run emulators with Functions.
3. Storefront → product → choose **size + color** → add to cart.
4. Panier → fill checkout (leave honeypot empty) → optional promo `WOD10`.
5. Submit → Function validates, prices, decrements stock, writes `orders/{id}`.
6. Browser opens `wa.me` with the **server-built** message.
7. `notifyOrder` fires → Telegram message (needs secrets in production; skip locally if unset).
8. Admin → Commandes → change status.

## Deploy

See **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)** for console setup, Blaze, admin claim, and secrets.

```bash
firebase deploy --only firestore:rules,storage,functions,hosting
```

```bash
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
firebase functions:secrets:set TELEGRAM_CHAT_ID
```

## SEO & sharing

- Share links use `/p/<productId>` → `productShare` (Open Graph + JSON-LD + redirect to `produit-detail.html?id=`).
- `/sitemap.xml` is generated dynamically.
- `robots.txt` points to the sitemap; admin is disallowed.

## Pre-launch checklist

- [ ] Firebase Blaze enabled; web config filled in `admin/firebase-config.js`
- [ ] Auth Email/Password on; admin user created; `set-admin-claim.js` run
- [ ] `firestore.rules` + `storage.rules` tested in emulator Rules playground
- [ ] Functions deployed; Telegram secrets set; test order → Telegram alert received
- [ ] Hosting live; test order end-to-end (stock decrements, WhatsApp opens)
- [ ] OG preview verified (share `/p/<id>` in WhatsApp / Facebook Sharing Debugger)
- [ ] Sitemap submitted in [Google Search Console](https://search.google.com/search-console)
- [ ] `serviceAccountKey.json` not in git; no Telegram secrets in Firestore
- [ ] Delivery fee, WhatsApp number, banner/flash sale reviewed in Admin → Paramètres

## License

Private — GMCrossfit. All rights reserved.
