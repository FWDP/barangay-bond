import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Config credentials provided by user
const firebaseConfig = {
  apiKey: "AIzaSyCoHpfd47Uul4D2saRfzZwNRl-UCFWxgno",
  authDomain: "tugma-8514e.firebaseapp.com",
  projectId: "tugma-8514e",
  storageBucket: "tugma-8514e.firebasestorage.app",
  messagingSenderId: "578517024363",
  appId: "1:578517024363:web:5ed04cf894eb1e73f4bb2e",
  measurementId: "G-874ELHD8J6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
