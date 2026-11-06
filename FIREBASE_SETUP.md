# Firebase Setup — GMCrossfit

Step-by-step guide to wire the project to a real Firebase project and go live.

## 1. Create the Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. **Add project** → name it (e.g. `gmcrossfit`).
3. Disable Google Analytics if you do not need it (optional).
4. When the project is ready, note the **Project ID**.

## 2. Enable Blaze (pay-as-you-go)

Cloud Functions (2nd gen) and Secret Manager require the **Blaze** plan.

1. Console → gear → **Usage and billing** → **Modify plan** → Blaze.
2. Link a billing account. Emulators remain free; production Functions/egress are billed.

## 3. Register a Web app

1. Project overview → **Add app** → Web (`</>`).
2. Nickname: `gmcrossfit-storefront`.
3. Copy the `firebaseConfig` object into:
   - `admin/firebase-config.js` → `FIREBASE_CONFIG`
4. Update `.firebaserc`:

```json
{
  "projects": {
    "default": "YOUR_PROJECT_ID"
  }
}
```

## 4. Enable products

| Product | Action |
|--------|--------|
| **Authentication** | Sign-in method → **Email/Password** → Enable |
| **Firestore** | Create database → production mode → pick region close to you (prefer `europe-west1` to match Functions) |
| **Storage** | Get started → same region if possible |
| **Functions** | Will deploy from CLI (needs Blaze) |
| **Hosting** | Will deploy from CLI |

## 5. Create the admin user

1. Authentication → **Users** → **Add user**.
2. Email + password (store them securely).
3. Grant the custom claim:

```bash
# Download service account key:
# Project settings → Service accounts → Generate new private key
# Save as serviceAccountKey.json at project root (gitignored)

npm install
node scripts/set-admin-claim.js admin@yourdomain.com
```

4. Sign out / sign in once in `/admin/login.html` so the new ID token includes `admin: true`.

## 6. Security rules

Security model:

- **`isAdmin()`** = signed-in user with `request.auth.token.admin == true`.
- **products / categories / packs / settings/public**: public **read**, **write** only if admin.
- **orders**: **no** public create/read. Admins can read/update. Creates happen **only** via the `createOrder` Cloud Function (Admin SDK bypasses rules).
- **page_views / product_clicks / rate_limits**: **no** client access (Functions only).
- **Storage**: public read on product/category/pack/banner images; write if admin + image + &lt; 2 MB.

Deploy:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Test in the Emulator Suite Rules playground before production.

## 7. Secrets (Telegram) — never in Firestore

```bash
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
firebase functions:secrets:set TELEGRAM_CHAT_ID
```

- Create a bot with [@BotFather](https://t.me/BotFather) → copy the token.
- Get your chat id (e.g. message [@userinfobot](https://t.me/userinfobot) or use a group id).

These are wired with `defineSecret` in `functions/notifyOrder.js`. They must **never** appear in `settings/public` or client JS.

## 8. Install & deploy Functions + Hosting

```bash
cd functions && npm install && cd ..
firebase deploy --only functions,hosting
```

Confirm rewrites in `firebase.json`:

- `/p/**` → `productShare` (europe-west1)
- `/sitemap.xml` → `sitemap` (europe-west1)

Set `SITE_URL` if your Hosting URL is not `https://gmcrossfit.web.app` (optional env / update defaults in `productShare.js` and `sitemap.js`).

## 9. Seed sample data

```bash
node scripts/seed.js
```

Then open the storefront Hosting URL and `/admin/`.

## 10. Public settings

In **Admin → Paramètres**, set:

- WhatsApp number (country code, digits only, e.g. `2126…`)
- Delivery fee / free threshold
- Banner, flash sale, promo codes (`WOD10`, `GM50` are seeded)

## Security checklist

- [ ] `serviceAccountKey.json` is **not** committed
- [ ] Telegram secrets only in Secret Manager
- [ ] Admin claim verified (`admin: true` on token)
- [ ] Rules deployed; client cannot write `orders`
- [ ] Storage writes require admin + image MIME + size limit
- [ ] Honeypot field present on checkout form
