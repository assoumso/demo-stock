import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBvnNnwZ9Kc4C8gNRrn_fChtMdccRg9b24",
  authDomain: "syllaadjame-ab102.firebaseapp.com",
  projectId: "syllaadjame-ab102",
  storageBucket: "syllaadjame-ab102.firebasestorage.app",
  messagingSenderId: "741614938748",
  appId: "1:741614938748:web:1a335aea4878d4236df7f9",
  measurementId: "G-WEW69H5C7H"
};

// Initialisation unique de l'application Firebase (Pattern Singleton)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Exportation des instances de service liées explicitement à l'instance 'app'
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export { firebaseConfig };