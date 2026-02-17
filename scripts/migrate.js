import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, doc } from 'firebase/firestore';

// Configuration Source (Actuelle)
const sourceConfig = {
  apiKey: "AIzaSyDz6SoxvDlrRTetdmH8IYHLzk97F9_EqLo",
  authDomain: "fir-stockage-bdf18.firebaseapp.com",
  projectId: "fir-stockage-bdf18",
  storageBucket: "fir-stockage-bdf18.firebasestorage.app",
  messagingSenderId: "727964725105",
  appId: "1:727964725105:web:7cc902497db6189e5310d0",
};

// Configuration Destination (Nouvelle)
const destConfig = {
   apiKey: "AIzaSyCZhq6k0CiAnVl5a2X7mP3MJzqVHzVFGBg",
   authDomain: "arouna-4882e.firebaseapp.com",
   projectId: "arouna-4882e",
   storageBucket: "arouna-4882e.firebasestorage.app",
   messagingSenderId: "667474176072",
   appId: "1:667474176072:web:dc5b66b8c6484760f1107d"
};

// Initialisation des deux applications
const sourceApp = initializeApp(sourceConfig, 'source');
const destApp = initializeApp(destConfig, 'dest');

const sourceDb = getFirestore(sourceApp);
const destDb = getFirestore(destApp);

// Liste des collections à migrer
const collections = [
  "products", 
  "categories", 
  "brands", 
  "units", 
  "warehouses", 
  "suppliers", 
  "customers", 
  "sales", 
  "purchases", 
  "stockAdjustments", 
  "warehouseTransfers", 
  "appSettings", 
  "settings", // Par sécurité
  "users", 
  "roles", 
  "creditNotes", 
  "supplierCreditNotes", 
  "salePayments", 
  "purchasePayments"
];

async function migrate() {
  console.log("🚀 Démarrage de la migration...");
  console.log(`De: ${sourceConfig.projectId}`);
  console.log(`Vers: ${destConfig.projectId}`);
  console.log("-----------------------------------");

  for (const colName of collections) {
    process.stdout.write(`Traitement de la collection '${colName}'... `);
    try {
      const snap = await getDocs(collection(sourceDb, colName));
      if (snap.empty) {
        console.log(`(Vide)`);
        continue;
      }
      
      let count = 0;
      const promises = [];
      
      for (const d of snap.docs) {
        // Copie asynchrone pour la vitesse
        promises.push(setDoc(doc(destDb, colName, d.id), d.data()));
        count++;
      }
      
      await Promise.all(promises);
      console.log(`✅ ${count} documents copiés.`);
    } catch (e) {
      console.log(`❌ Erreur: ${e.message}`);
    }
  }
  
  console.log("-----------------------------------");
  console.log("✨ Migration terminée !");
  process.exit(0);
}

migrate();
