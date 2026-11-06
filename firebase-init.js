/**
 * Single Firebase app instance for the storefront.
 * Imports Firebase v10.8.0 from the official CDN (ES modules).
 */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";
import {
  FIREBASE_CONFIG,
  FUNCTIONS_REGION,
  shouldUseEmulators,
} from "./admin/firebase-config.js";

let _firebase = null;

/**
 * Returns a singleton { app, db, auth, storage, functions }.
 * Connects to emulators on localhost automatically.
 */
export function getFirebase() {
  if (_firebase) return _firebase;

  const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
  const db = getFirestore(app);
  const auth = getAuth(app);
  const storage = getStorage(app);
  const functions = getFunctions(app, FUNCTIONS_REGION);

  if (shouldUseEmulators() && !globalThis.__GMC_EMULATORS_CONNECTED__) {
    try {
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      connectStorageEmulator(storage, "127.0.0.1", 9199);
      connectFunctionsEmulator(functions, "127.0.0.1", 5001);
      globalThis.__GMC_EMULATORS_CONNECTED__ = true;
      console.info("[GMCrossfit] Connected to Firebase Emulators");
    } catch (err) {
      console.warn("[GMCrossfit] Emulator connect skipped:", err.message);
    }
  }

  _firebase = { app, db, auth, storage, functions };
  return _firebase;
}

export { FIREBASE_CONFIG, FUNCTIONS_REGION };
