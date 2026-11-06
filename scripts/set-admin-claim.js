/**
 * Grant custom claim { admin: true } to a Firebase Auth user by email.
 *
 * Prerequisites:
 * 1. Create the user in Firebase Console → Authentication (Email/Password).
 * 2. Download a service account key:
 *    Console → Project settings → Service accounts → Generate new private key
 *    Save as serviceAccountKey.json at the project root (gitignored).
 *
 * Usage:
 *   node scripts/set-admin-claim.js admin@example.com
 *
 * Then the user must sign out and sign back in (or refresh the ID token)
 * for the claim to appear in request.auth.token.admin.
 *
 * Emulator mode:
 *   set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 *   set FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
 *   (On PowerShell: $env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099")
 *   Still needs a projectId; use GOOGLE_CLOUD_PROJECT=gmcrossfit-demo
 */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/set-admin-claim.js <email>");
  process.exit(1);
}

const keyPath = path.join(__dirname, "..", "serviceAccountKey.json");
const usingEmulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

if (!usingEmulator && !fs.existsSync(keyPath)) {
  console.error(
    "Missing serviceAccountKey.json at project root.\n" +
      "Download it from Firebase Console → Project settings → Service accounts."
  );
  process.exit(1);
}

if (usingEmulator) {
  admin.initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT || "gmcrossfit-demo" });
  console.log("Using Auth Emulator at", process.env.FIREBASE_AUTH_EMULATOR_HOST);
} else {
  const serviceAccount = require(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function main() {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  console.log(`OK — admin:true granted to ${email} (uid: ${user.uid})`);
  console.log("Ask the user to sign out / sign in again so the new token is issued.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
