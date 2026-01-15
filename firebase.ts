import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDz6SoxvDlrRTetdmH8IYHLzk97F9_EqLo",
  authDomain: "fir-stockage-bdf18.firebaseapp.com",
  projectId: "fir-stockage-bdf18",
  storageBucket: "fir-stockage-bdf18.firebasestorage.app",
  messagingSenderId: "727964725105",
  appId: "1:727964725105:web:7cc902497db6189e5310d0",
};

// Initialisation unique de l'application Firebase (Pattern Singleton)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Exportation des instances de service liées explicitement à l'instance 'app'
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export { firebaseConfig };