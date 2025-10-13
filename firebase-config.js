// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDVmdvisnkt22pfTP8uBTSleUr6O56PxYQ",
  authDomain: "collectify-51d7e.firebaseapp.com",
  databaseURL:
    "https://collectify-51d7e-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "collectify-51d7e",
  storageBucket: "collectify-51d7e.appspot.com", // <- appspot.com
  messagingSenderId: "373482976361",
  appId: "1:373482976361:web:9dd36b0f209bce5f749ef8",
  measurementId: "G-KSTGPYGXP4",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// (Valgfrit) analytics – men sikkert:
let analytics = null;
if (
  typeof window !== "undefined" &&
  window?.location?.protocol?.startsWith("http")
) {
  import("firebase/analytics").then(({ getAnalytics }) => {
    try {
      analytics = getAnalytics(app);
    } catch (err) {
      console.warn("Analytics disabled:", err?.message || err);
    }
  });
}
export { analytics };

// src/firebase.js – robust version
export const ensureAnonAuth = () =>
  new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u || { uid: null });
    });
    signInAnonymously(auth).catch((err) => {
      console.warn("Anon auth failed:", err?.message || err);
      // vi lader onAuthStateChanged fyre med null => resolve
    });
  });
