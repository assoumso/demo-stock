const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, addDoc, writeBatch, doc } = require('firebase/firestore');

// Configuration de la base source (barakasoft-6nsk8)
const sourceConfig = {
    apiKey: "AIzaSyBV-lsqnk033iPYHy0gFERS3pQMl2OBd8c",
    authDomain: "barakasoft-6nsk8.firebaseapp.com",
    projectId: "barakasoft-6nsk8",
    storageBucket: "barakasoft-6nsk8.firebasestorage.app",
    messagingSenderId: "542795664324",
    appId: "1:542795664324:web:648205fdd50caa9c1af291"
};

// Configuration de la base cible (fir-phyto)
const targetConfig = {
    apiKey: "AIzaSyC8NkwUfKuQ0LJMB-qpkfZzF5_HgQ6F-Vo",
    authDomain: "fir-phyto.firebaseapp.com",
    projectId: "fir-phyto",
    storageBucket: "fir-phyto.firebasestorage.app",
    messagingSenderId: "1044699419288",
    appId: "1:1044699419288:web:0b8e5f0b941c7fb599e93b"
};

async function migrateCollection(sourceDb, targetDb, collectionName) {
    console.log(`Migration de la collection: ${collectionName}`);
    
    try {
        const sourceCollection = collection(sourceDb, collectionName);
        const sourceSnapshot = await getDocs(sourceCollection);
        
        if (sourceSnapshot.empty) {
            console.log(`Aucun document trouvé dans ${collectionName}`);
            return;
        }
        
        const batch = writeBatch(targetDb);
        let count = 0;
        
        for (const sourceDoc of sourceSnapshot.docs) {
            const data = sourceDoc.data();
            const targetDocRef = doc(targetDb, collectionName, sourceDoc.id);
            batch.set(targetDocRef, data);
            count++;
            
            // Commit tous les 500 documents
            if (count % 500 === 0) {
                await batch.commit();
                console.log(`Migrés ${count} documents dans ${collectionName}`);
            }
        }
        
        // Commit les documents restants
        await batch.commit();
        console.log(`Migration terminée pour ${collectionName}: ${count} documents migrés`);
        
    } catch (error) {
        console.error(`Erreur lors de la migration de ${collectionName}:`, error);
    }
}

async function migrateAllData() {
    console.log('Démarrage de la migration des données...');
    
    // Initialiser les applications Firebase
    const sourceApp = initializeApp(sourceConfig, 'source');
    const targetApp = initializeApp(targetConfig, 'target');
    
    const sourceDb = getFirestore(sourceApp);
    const targetDb = getFirestore(targetApp);
    
    // Liste des collections à migrer
    const collections = [
        'products',
        'categories', 
        'brands',
        'suppliers',
        'customers',
        'warehouses',
        'sales',
        'purchases',
        'warehouseTransfers',
        'stockAdjustments',
        'creditNotes',
        'supplierCreditNotes',
        'settings',
        'users'
    ];
    
    // Migrer chaque collection
    for (const collectionName of collections) {
        await migrateCollection(sourceDb, targetDb, collectionName);
    }
    
    console.log('Migration terminée avec succès!');
}

// Exécuter la migration
migrateAllData().catch(console.error);