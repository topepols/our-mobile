// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your exact config from the Electron app
const firebaseConfig = {
  apiKey: "AIzaSyDnv01fHrHKPzDWLQCjolEHclIiapBK9vI", // (Note: Keep this safe in production)
  authDomain: "electron-6a45b.firebaseapp.com",
  projectId: "electron-6a45b",
  storageBucket: "electron-6a45b.firebasestorage.app",
  messagingSenderId: "173561788996",
  appId: "1:173561788996:web:ed601085cc929b1afb5a11",
  measurementId: "G-0RJH0GK69L"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);