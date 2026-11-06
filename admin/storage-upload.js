/**
 * Compress image via Canvas (~1000px max side, JPEG quality 0.72)
 * then upload to Firebase Storage with long cacheControl.
 */
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getFirebase } from "../firebase-init.js";

const MAX_SIDE = 1000;
const JPEG_QUALITY = 0.72;
const CACHE_CONTROL = "public,max-age=31536000,immutable";

/**
 * @param {File} file
 * @returns {Promise<Blob>}
 */
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Fichier image requis."));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Image trop lourde (max 8 Mo avant compression)."));
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression échouée."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire l'image."));
    };
    img.src = url;
  });
}

/**
 * Upload a File to Storage under folder/filename.
 * @param {File} file
 * @param {string} folder  e.g. "products"
 * @param {string} [customName]
 * @returns {Promise<{ url: string, storagePath: string }>}
 */
export async function uploadCompressedImage(file, folder, customName) {
  const blob = await compressImage(file);
  const { storage } = getFirebase();
  const safeName = (customName || file.name || "image")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 60);
  const storagePath = `${folder}/${Date.now()}_${safeName}.jpg`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, blob, {
    contentType: "image/jpeg",
    cacheControl: CACHE_CONTROL,
  });

  const url = await getDownloadURL(storageRef);
  return { url, storagePath };
}
