/**
 * Shared Firebase web config.
 * Replace placeholders with your Firebase Console project values.
 * Used by both the storefront (via firebase-init.js) and the admin panel.
 */
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBtxinViqFwR_g_opu3GjlD1on6buBVdF0",
  authDomain: "gmcrossfit.firebaseapp.com",
  projectId: "gmcrossfit",
  storageBucket: "gmcrossfit.firebasestorage.app",
  messagingSenderId: "690818303872",
  appId: "1:690818303872:web:821fecc1dbd2966cbae365",
  measurementId: "G-NTZXSP8LPQ"
};

/** Cloud Functions region (must match functions/index exports). */
export const FUNCTIONS_REGION = "europe-west1";

/**
 * When true (or when running on localhost), connect to Firebase Emulators.
 * Override with ?emulators=0 to force production even on localhost.
 */
export function shouldUseEmulators() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("emulators") === "0") return false;
  if (params.get("emulators") === "1") return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}
