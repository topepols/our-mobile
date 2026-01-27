import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // <--- KEEP THIS IMPORT
// import { getAnalytics } from "firebase/analytics"; // Optional: You probably don't need analytics for an internal inventory app

const firebaseConfig = {
  // --- USING YOUR NEW KEYS (jdghub) ---
  apiKey: "AIzaSyB8O8xLHhI7Rslo2ukdj2iS0LK8BczyLTU",
  authDomain: "jdghub.firebaseapp.com",
  projectId: "jdghub",
  storageBucket: "jdghub.firebasestorage.app",
  messagingSenderId: "20812849661",
  appId: "1:20812849661:web:6cfb135e6dc2f375213994",
  measurementId: "G-65ERZW6077"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// --- KEEP THIS LOGIC ---
// This creates the database connection your App.js is asking for.
const db = getFirestore(app);

export { db };