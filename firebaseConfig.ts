// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAIYHwhZhcNWb-46iZ13UrS1iyK-PgIH3Q",
  authDomain: "ecotrack-1201d.firebaseapp.com",
  databaseURL: "https://ecotrack-1201d-default-rtdb.firebaseio.com/",
  projectId: "ecotrack-1201d",
  storageBucket: "ecotrack-1201d.firebasestorage.app",
  messagingSenderId: "878437557247",
  appId: "1:878437557247:web:1be11bb359d3ba4ce43dca",
  measurementId: "G-GWCLZEMCDB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
