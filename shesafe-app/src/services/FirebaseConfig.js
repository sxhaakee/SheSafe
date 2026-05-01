// SheSafe — Firebase Configuration
// Using Firebase JS SDK v10 (modular API)
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDpbH1nHcMWYOTDJ760spAeMaBO3GsB4lU",
  authDomain: "shesafe-d2928.firebaseapp.com",
  projectId: "shesafe-d2928",
  storageBucket: "shesafe-d2928.appspot.com",
  messagingSenderId: "1005842498901",
  appId: "1:1005842498901:web:shesafe_app",
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
