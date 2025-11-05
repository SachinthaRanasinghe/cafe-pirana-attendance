// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth'; // ✅ Add this

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBrOI8XqyYzWgE-sKMEjJMdeGtoKz7Pt2o",
  authDomain: "cafe-pirana-attendance.firebaseapp.com",
  projectId: "cafe-pirana-attendance",
  storageBucket: "cafe-pirana-attendance.appspot.com",
  messagingSenderId: "1009772109491",
  appId: "1:1009772109491:web:5d0d28f9495e016567dac6",
  measurementId: "G-QQB2PXFPWK"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ Initialize Services
export const db = getFirestore(app);
export const auth = getAuth(app); // ✅ Export Auth
export const analytics = getAnalytics(app);
