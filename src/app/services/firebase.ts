import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: "easyrecipe-68ba1.firebaseapp.com",
  projectId: "easyrecipe-68ba1",
  storageBucket: "easyrecipe-68ba1.firebasestorage.app",
  messagingSenderId: "76813742735",
  appId: "1:76813742735:web:32f636fbab57e02ed176fa",
  measurementId: "G-4S5VKWPFBP"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
