
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCxjlbmMPV5o4yLod5em4RTPJgDJ1lBARg",
  authDomain: "fir-stockage-bdf18.firebaseapp.com",
  projectId: "fir-stockage-bdf18",
  storageBucket: "fir-stockage-bdf18.firebasestorage.app",
  messagingSenderId: "727964725105",
  appId: "1:727964725105:web:7cc902497db6189e5310d0",
};

// Initialisation de Firebase (Format Modulaire)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage, firebaseConfig };
