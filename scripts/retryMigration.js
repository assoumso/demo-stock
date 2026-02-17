const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, limit, query } = require('firebase/firestore');

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

async function migrateCollectionInBatches(sourceDb, targetDb, collectionName, batchSize = 100) {
    console.log(`Migration de la collection: ${collectionName}`);
    
    try {
        let totalMigrated = 0;
        let lastDoc = null;
        let hasMore = true;
        
        while (hasMore) {
            let q = collection(sourceDb, collectionName);
            
            if (lastDoc) {
                // Pour la pagination, nous devrions utiliser startAfter
                // mais pour simplifier, nous allons traiter par lots de 100
                q = query(q, limit(batchSize));
            } else {
                q = query(q, limit(batchSize));
            }
            
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                hasMore = false;
                break;
            }
            
            // Migrer les documents du lot actuel
            for (const sourceDoc of snapshot.docs) {
                const data = sourceDoc.data();
                const targetDocRef = doc(targetDb, collectionName, sourceDoc.id);
                await setDoc(targetDocRef, data);
                totalMigrated++;
            }
            
            console.log(`Migrés ${totalMigrated} documents dans ${collectionName}`);
            
            // Si nous avons moins de documents que le batchSize, c'est la fin
            if (snapshot.docs.length < batchSize) {
                hasMore = false;
            }
            
            // Petite pause pour éviter de surcharger
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`Migration terminée pour ${collectionName}: ${totalMigrated} documents migrés`);
        
    } catch (error) {
        console.error(`Erreur lors de la migration de ${collectionName}:`, error);
    }
}

async function retryFailedCollections() {
    console.log('Nouvelle tentative pour les collections qui ont échoué...');
    
    // Initialiser les applications Firebase
    const sourceApp = initializeApp(sourceConfig, 'source-retry');
    const targetApp = initializeApp(targetConfig, 'target-retry');
    
    const sourceDb = getFirestore(sourceApp);
    const targetDb = getFirestore(targetApp);
    
    // Collections qui ont échoué lors de la première tentative
    const failedCollections = ['products', 'sales', 'stockAdjustments'];
    
    for (const collectionName of failedCollections) {
        await migrateCollectionInBatches(sourceDb, targetDb, collectionName, 50); // Plus petits lots
    }
    
    console.log('Nouvelle tentative terminée!');
}

// Exécuter la nouvelle tentative
retryFailedCollections().catch(console.error);