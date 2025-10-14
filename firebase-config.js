import { initializeApp } from "firebase/app";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  connectAuthEmulator,
} from "firebase/auth";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Persistence
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Kunne ikke sætte persistence:", err?.message || err);
});

// Emulatorer i dev
if (typeof window !== "undefined" && location.hostname === "localhost") {
  try {
    connectAuthEmulator(auth, "http://127.0.0.1:9099");
    connectDatabaseEmulator(db, "127.0.0.1", 9000);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
  } catch (err) {
    console.warn(
      "Kunne ikke forbinde til Firebase emulatorer:",
      err?.message || err
    );
  }
}

// Analytics (valgfrit)
let analytics = null;
if (
  typeof window !== "undefined" &&
  /^https?:/.test(window.location.protocol)
) {
  import("firebase/analytics")
    .then(({ getAnalytics }) => {
      try {
        analytics = getAnalytics(app);
      } catch (err) {
        console.warn("Analytics slået fra:", err?.message || err);
      }
    })
    .catch((err) => {
      console.warn("Kunne ikke loade analytics:", err?.message || err);
    });
}
export { analytics };

/**
 * ensureAnonAuth(options)
 * - Public mode: resolver ALTID (User eller null)
 * - Forsøger anonym login (kan fejle, vi hænger aldrig)
 * - Singleton: undgår race-conditions
 */
let _authReadyPromise = null;

export function ensureAnonAuth({ allowGuest = true, timeoutMs = 1500 } = {}) {
  if (_authReadyPromise) return _authReadyPromise;

  _authReadyPromise = new Promise((resolve) => {
    if (auth.currentUser) return resolve(auth.currentUser);

    let settled = false;
    let cleanup = () => {};
    try {
      const unsub = onAuthStateChanged(auth, (u) => {
        if (!settled && u) {
          settled = true;
          try {
            unsub();
          } catch (err) {
            console.debug(
              "Auth unsubscribe cleanup fejlede:",
              err?.message || err
            );
          }
          resolve(u);
        }
      });
      cleanup = () => {
        try {
          unsub();
        } catch (err) {
          console.debug(
            "Auth unsubscribe cleanup fejlede:",
            err?.message || err
          );
        }
      };
    } catch (err) {
      console.warn(
        "Kunne ikke registrere onAuthStateChanged:",
        err?.message || err
      );
    }

    if (allowGuest) {
      signInAnonymously(auth).catch((err) => {
        console.warn("Anonym login fejlede:", err?.code || err?.message || err);
      });
    }

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          cleanup();
        } catch (err) {
          console.debug("Cleanup efter timeout fejlede:", err?.message || err);
        }
        resolve(null); // public mode → fortsæt uden bruger
      }
    }, timeoutMs);

    // ekstra sikkerhed: ryd timer hvis vinduet lukkes el.lign.
    window?.addEventListener?.("beforeunload", () => {
      try {
        clearTimeout(timer);
      } catch (err) {
        console.debug("clearTimeout fejlede:", err?.message || err);
      }
      try {
        cleanup();
      } catch (err) {
        console.debug("Cleanup ved beforeunload fejlede:", err?.message || err);
      }
    });
  });

  return _authReadyPromise;
}

// Hjælpere
export const getCurrentUid = () => auth.currentUser?.uid || null;
export const hasUser = () => !!auth.currentUser;
