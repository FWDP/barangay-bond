import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Config credentials loaded from environment variables
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSy_FIREBASE_API_KEY_PLACEHOLDER";

if (!import.meta.env.VITE_FIREBASE_API_KEY) {
  console.warn(
    "[Firebase] VITE_FIREBASE_API_KEY is not set in your .env file. Please add your Firebase Web API Key in .env to enable authentication."
  );
}

const firebaseConfig = {
  apiKey: apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "tugma-8514e.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "tugma-8514e",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "tugma-8514e.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "578517024363",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:578517024363:web:5ed04cf894eb1e73f4bb2e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-874ELHD8J6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

