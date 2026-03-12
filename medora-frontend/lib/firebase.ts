import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAIBEw24YhSJAFXpYoJjzj2lw7agzZRg1Y",
  authDomain: "medora-auth.firebaseapp.com",
  projectId: "medora-auth",
  storageBucket: "medora-auth.firebasestorage.app",
  messagingSenderId: "1027823816282",
  appId: "1:1027823816282:web:d9fa5ac1f993145793d263",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;