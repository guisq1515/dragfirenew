import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use auto-detect long polling for better flexibility on diverse mobile networks
const dbSettings = { 
  experimentalForceLongPolling: true,
  localCache: memoryLocalCache()
};

export const db = initializeFirestore(app, dbSettings);

export const auth = getAuth(app);
export const storage = getStorage(app);
// Analytics initialization can fail on startup if offline (Firebase Installations error)
let analyticsInstance = null;
if (typeof window !== 'undefined') {
  try {
    analyticsInstance = getAnalytics(app);
  } catch (e) {
    console.warn("Firebase Analytics failed to initialize (likely offline):", e);
  }
}

export const analytics = analyticsInstance;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
