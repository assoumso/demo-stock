import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
   apiKey: "AIzaSyCZhq6k0CiAnVl5a2X7mP3MJzqVHzVFGBg",
   authDomain: "arouna-4882e.firebaseapp.com",
   projectId: "arouna-4882e",
   storageBucket: "arouna-4882e.firebasestorage.app",
   messagingSenderId: "667474176072",
   appId: "1:667474176072:web:dc5b66b8c6484760f1107d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateSettings() {
    console.log("🚀 Mise à jour des paramètres de l'application...");

    const settingsRef = doc(db, 'appSettings', 'app-config');
    const settingsDoc = await getDoc(settingsRef);
    
    // Fallback si le doc n'existe pas encore (cas rare après migration mais possible)
    const currentData = settingsDoc.exists() ? settingsDoc.data() : {};

    const newSettings = {
        ...currentData,
        companyName: 'RIDWANE-SUPERMARCHE',
        companyLogoUrl: '/logo.svg', // Utilise le nouveau SVG
        themeColor: 'gold', // Force le thème Or
        invoiceFooterText: 'Merci de votre visite chez RIDWANE-SUPERMARCHE !',
        // On garde les autres champs existants
    };

    try {
        await setDoc(settingsRef, newSettings, { merge: true });
        
        // Mise à jour de la collection 'settings' (doublon possible selon l'architecture)
        await setDoc(doc(db, 'settings', 'app-config'), newSettings, { merge: true });

        console.log("✅ Paramètres mis à jour avec succès dans Firestore !");
        console.log("   - Nom: RIDWANE-SUPERMARCHE");
        console.log("   - Logo: /logo.svg");
        console.log("   - Thème: gold");
    } catch (error) {
        console.error("❌ Erreur lors de la mise à jour :", error);
    }
    process.exit(0);
}

updateSettings();
