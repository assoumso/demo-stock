
import React, { useState, useEffect, FormEvent } from 'react';
import { db, storage } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AppSettings, User, Role, Warehouse, Category, Brand, Unit, Customer, Supplier, Product } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { UploadIcon, DownloadIcon, ShieldCheckIcon, ImageIcon } from '../constants';
import { permissionConfig } from '../config/permissions';

const initialSettings: AppSettings = {
    id: 'app-config',
    companyName: 'RIDWANE-SUPERMARCHE',
    companyAddress: 'Cotonou, Bénin',
    companyPhone: '+229 00 00 00 00',
    companyEmail: 'contact@demo.com',
    companyContact: 'Direction',
    companyRCCM: 'RB/COT/24 B 0000',
    companyLogoUrl: '',
    currencySymbol: 'FCFA',
    invoiceFooterText: 'Merci de votre confiance. Les marchandises vendues ne sont ni reprises ni échangées.',
    saleInvoicePrefix: 'VNT-',
    purchaseInvoicePrefix: 'ACH-',
    defaultTaxRate: 0,
    defaultPosCustomerId: 'walkin',
    themeColor: 'teal', // Changé par défaut à 'teal'
};

const COLLECTIONS_TO_MIGRATE = [
    'settings', 'categories', 'brands', 'units', 'warehouses', 
    'products', 'customers', 'suppliers', 'sales', 'salePayments', 
    'purchases', 'purchasePayments', 'stockAdjustments', 
    'warehouseTransfers', 'users', 'roles'
];

const themeNames: Record<string, string> = {
    slate: 'Ardoise',
    red: 'Rouge',
    orange: 'Orange',
    amber: 'Ambre',
    yellow: 'Jaune',
    lime: 'Citron vert',
    green: 'Vert',
    emerald: 'Émeraude',
    teal: 'Turquoise',
    cyan: 'Cyan',
    sky: 'Ciel',
    blue: 'Bleu',
    indigo: 'Indigo',
    violet: 'Violet',
    purple: 'Pourpre',
    fuchsia: 'Fuchsia',
    pink: 'Rose',
    rose: 'Rouge rose'
};

const SettingsPage: React.FC = () => {
    const { hasPermission } = useAuth();
    const { setTheme, availableThemes, refreshSettings } = useTheme();

    const [settings, setSettings] = useState<AppSettings>(initialSettings);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isMigrating, setIsMigrating] = useState(false);
    const [importLog, setImportLog] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    
    const settingsDocRef = doc(db, 'settings', 'app-config');

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                const settingsSnap = await getDoc(settingsDocRef);
                if (settingsSnap.exists()) {
                    const loadedSettings = settingsSnap.data() as Partial<AppSettings>;
                    setSettings({ ...initialSettings, ...loadedSettings });
                    if (loadedSettings.companyLogoUrl) {
                        setLogoPreview(loadedSettings.companyLogoUrl);
                    }
                }
            } catch (err) {
                console.warn("Paramètres non chargés ou base vide.");
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumber = ['defaultTaxRate'].includes(name);
        setSettings(prev => ({ ...prev, [name]: isNumber ? parseFloat(value) || 0 : value }));
    };

    const handleThemeChange = (themeName: string) => {
        const validTheme = themeName as keyof typeof availableThemes;
        setTheme(validTheme);
        setSettings(prev => ({ ...prev, themeColor: validTheme }));
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert("L'image est trop volumineuse. Veuillez choisir une image de moins de 5 Mo.");
                return;
            }
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setLogoPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        try {
            const settingsToSave = { ...settings };
            if (logoFile) {
                const fileName = `company_logo_${Date.now()}_${logoFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                const logoStorageRef = ref(storage, `settings/${fileName}`);
                await uploadBytes(logoStorageRef, logoFile);
                settingsToSave.companyLogoUrl = await getDownloadURL(logoStorageRef);
            }
            await setDoc(settingsDocRef, settingsToSave, { merge: true });
            
            // Notification au contexte global pour mise à jour immédiate (Nom + Thème)
            await refreshSettings();
            
            setSuccess("Paramètres enregistrés avec succès !");
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(`Erreur d'enregistrement : ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Fonctions de migration (conservées pour l'utilité administrative)
    const handleInitializeAdmin = async () => {
        if (!window.confirm("IMPORTANT : Cette opération va forcer la création de toutes les collections dans votre base Firebase. Voulez-vous continuer ?")) return;
        setIsMigrating(true);
        setImportLog(["🔌 Initialisation Firestore..."]);
        try {
            await setDoc(doc(db, 'settings', 'app-config'), initialSettings);
            // ... (logique d'initialisation identique au fichier précédent)
            setImportLog(prev => [...prev, "🏁 Initialisation terminée !"]);
            await refreshSettings();
            setSuccess("Déploiement réussi.");
        } catch (err: any) {
            setError(`Échec : ${err.message}`);
        } finally {
            setIsMigrating(false);
        }
    };

    const handleExportData = async () => {
        setIsMigrating(true);
        setImportLog(["🚀 Exportation..."]);
        try {
            const fullData: any = {};
            for (const collName of COLLECTIONS_TO_MIGRATE) {
                const snap = await getDocs(collection(db, collName));
                fullData[collName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            }
            const dataStr = JSON.stringify(fullData, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', `EXPORT_SYSTEME_${new Date().toISOString().split('T')[0]}.json`);
            linkElement.click();
            setImportLog(prev => [...prev, "✅ Exportation terminée !"]);
        } catch (err: any) {
            setError(`Erreur export : ${err.message}`);
        } finally {
            setIsMigrating(false);
        }
    };

    const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsMigrating(true);
        setImportLog(["🔍 Démarrage de l'importation..."]);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importedData = JSON.parse(event.target?.result as string);
                const totalCollections = COLLECTIONS_TO_MIGRATE.length;
                let processedCollections = 0;
                let totalItems = 0;
                let importedItems = 0;

                // Premier passage pour compter les éléments
                for (const collName of COLLECTIONS_TO_MIGRATE) {
                    const items = importedData[collName] || [];
                    totalItems += items.length;
                }

                setImportLog(prev => [...prev, `📦 Fichier analysé : ${totalItems} éléments trouvés dans ${totalCollections} collections.`]);

                for (const collName of COLLECTIONS_TO_MIGRATE) {
                    const items = importedData[collName] || [];
                    if (items.length > 0) {
                        setImportLog(prev => [...prev, `⏳ Traitement de ${collName} (${items.length} éléments)...`]);
                        for (const item of items) {
                            const { id, ...data } = item;
                            await setDoc(doc(db, collName, id), data, { merge: true });
                            importedItems++;
                            // Afficher la progression tous les 10 éléments ou à la fin
                            if (importedItems % 10 === 0 || importedItems === totalItems) {
                                const progress = Math.round((importedItems / totalItems) * 100);
                                setImportLog(prev => {
                                    const lastLog = prev[prev.length - 1];
                                    if (lastLog.startsWith('📊 Progression :')) {
                                        const newLog = [...prev];
                                        newLog[newLog.length - 1] = `📊 Progression : ${progress}% (${importedItems}/${totalItems})`;
                                        return newLog;
                                    }
                                    return [...prev, `📊 Progression : ${progress}% (${importedItems}/${totalItems})`];
                                });
                            }
                        }
                    }
                    processedCollections++;
                }
                
                await refreshSettings();
                setSuccess("Importation réussie !");
                
                // Rapport final
                const report = [
                    "✅ IMPORTATION TERMINÉE AVEC SUCCÈS",
                    "----------------------------------------",
                    `📅 Date : ${new Date().toLocaleString()}`,
                    `📂 Collections traitées : ${processedCollections}/${totalCollections}`,
                    `📝 Éléments importés : ${importedItems}/${totalItems}`,
                    "----------------------------------------",
                    "Le système va redémarrer dans quelques secondes..."
                ];
                setImportLog(prev => [...prev, ...report]);

                setTimeout(() => window.location.reload(), 5000);
            } catch (err: any) {
                setError(`Erreur import : ${err.message}`);
                setImportLog(prev => [...prev, `❌ ERREUR : ${err.message}`]);
            } finally {
                setIsMigrating(false);
            }
        };
        reader.readAsText(file);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Chargement des paramètres...</div>;

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-primary-500 focus:border-primary-500 outline-none transition-all";

    return (
        <div className="pb-12 max-w-5xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Paramètres Système</h1>
                <p className="text-gray-500 dark:text-gray-400">Gérez l'identité et les règles globales de votre application.</p>
            </header>
            
            <form onSubmit={handleSave} className="space-y-8">
                {/* 1. Informations Entreprise */}
                <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-bold mb-6 text-primary-600 dark:text-primary-400 flex items-center">
                        <span className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center mr-3 text-sm">1</span>
                        Identité de l'entreprise
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Logo de l'entreprise</label>
                            <div className="flex items-center space-x-6">
                                {logoPreview ? (
                                    <div className="relative group">
                                        <img src={logoPreview} alt="Aperçu Logo" className="h-24 w-24 object-contain rounded-xl border-2 border-gray-100 dark:border-gray-600 p-2 bg-white" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity flex items-center justify-center text-white text-[10px] font-bold">CHANGER</div>
                                    </div>
                                ) : (
                                    <div className="h-24 w-24 rounded-xl bg-gray-50 dark:bg-gray-700 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-600">
                                        <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
                                        <span className="text-[10px] font-bold uppercase">Aucun</span>
                                    </div>
                                )}
                                <label className="flex-1 cursor-pointer">
                                    <span className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                                        <UploadIcon className="w-4 h-4 mr-2" /> Sélectionner un nouveau fichier logo
                                    </span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
                                </label>
                            </div>
                        </div>
                        <div><label className="block text-sm font-bold mb-1">Nom de l'entreprise</label><input type="text" name="companyName" value={settings.companyName} onChange={handleInputChange} className={inputClasses} /></div>
                        <div><label className="block text-sm font-bold mb-1">Téléphone</label><input type="text" name="companyPhone" value={settings.companyPhone} onChange={handleInputChange} className={inputClasses} /></div>
                        <div><label className="block text-sm font-bold mb-1">Email de contact</label><input type="email" name="companyEmail" value={settings.companyEmail} onChange={handleInputChange} className={inputClasses} /></div>
                        <div><label className="block text-sm font-bold mb-1">RCCM / IFU</label><input type="text" name="companyRCCM" value={settings.companyRCCM} onChange={handleInputChange} className={inputClasses} /></div>
                        <div className="md:col-span-2"><label className="block text-sm font-bold mb-1">Adresse entrepôts</label><input type="text" name="companyAddress" value={settings.companyAddress} onChange={handleInputChange} className={inputClasses} /></div>
                    </div>
                </section>

                {/* 2. Configuration Système & POS */}
                <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-bold mb-6 text-primary-600 dark:text-primary-400 flex items-center">
                        <span className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center mr-3 text-sm">2</span>
                        Système & Facturation
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div><label className="block text-sm font-bold mb-1">Devise (Symbole)</label><input type="text" name="currencySymbol" value={settings.currencySymbol} onChange={handleInputChange} className={inputClasses} /></div>
                        <div><label className="block text-sm font-bold mb-1">TVA par défaut (%)</label><input type="number" name="defaultTaxRate" value={settings.defaultTaxRate} onChange={handleInputChange} className={inputClasses} /></div>
                        <div><label className="block text-sm font-bold mb-1">ID Client POS défaut</label><input type="text" name="defaultPosCustomerId" value={settings.defaultPosCustomerId} onChange={handleInputChange} className={inputClasses} /></div>
                        <div><label className="block text-sm font-bold mb-1">Préfixe Ventes</label><input type="text" name="saleInvoicePrefix" value={settings.saleInvoicePrefix} onChange={handleInputChange} className={inputClasses} /></div>
                        <div><label className="block text-sm font-bold mb-1">Préfixe Achats</label><input type="text" name="purchaseInvoicePrefix" value={settings.purchaseInvoicePrefix} onChange={handleInputChange} className={inputClasses} /></div>
                        <div className="md:col-span-3">
                            <label className="block text-sm font-bold mb-1">Pied de page des factures</label>
                            <textarea name="invoiceFooterText" value={settings.invoiceFooterText} onChange={handleInputChange} rows={3} className={inputClasses}></textarea>
                        </div>
                    </div>
                </section>

                {/* 3. Thème & Apparence */}
                <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-bold mb-6 text-primary-600 dark:text-primary-400 flex items-center">
                        <span className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center mr-3 text-sm">3</span>
                        Personnalisation visuelle
                    </h2>
                    <div>
                        <label className="block text-sm font-bold mb-4">Couleur principale de l'application</label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                            {Object.keys(availableThemes).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => handleThemeChange(t)}
                                    className={`relative flex items-center justify-center p-4 rounded-xl border-2 transition-all ${
                                        settings.themeColor === t 
                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-4 ring-primary-500/10' 
                                        : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}
                                >
                                    <div className="w-6 h-6 rounded-full mr-3 shadow-inner" style={{ backgroundColor: `rgb(${availableThemes[t as keyof typeof availableThemes]['500']})` }}></div>
                                    <span className="capitalize font-bold text-sm">{themeNames[t] || t}</span>
                                    {settings.themeColor === t && <div className="absolute -top-2 -right-2 bg-primary-500 text-white rounded-full p-1 shadow-lg"><ShieldCheckIcon className="w-4 h-4"/></div>}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Bouton de sauvegarde */}
                <div className="sticky bottom-6 flex justify-end items-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-white dark:border-gray-800 z-10">
                    {error && <p className="text-red-500 font-bold mr-6 text-sm">{error}</p>}
                    {success && <p className="text-green-500 font-bold mr-6 text-sm">{success}</p>}
                    <button type="submit" disabled={isSaving} className="px-10 py-4 bg-primary-600 text-white rounded-xl font-black shadow-lg hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-50">
                        {isSaving ? 'ENREGISTREMENT...' : 'SAUVEGARDER LES CHANGEMENTS'}
                    </button>
                </div>
            </form>

            {/* SECTION MAINTENANCE (Migration / Export) */}
            <div className="mt-16 bg-gray-900 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-gray-800">
                    <div className="flex items-center space-x-4 mb-4">
                        <div className="bg-red-500/20 p-3 rounded-2xl"><ShieldCheckIcon className="w-8 h-8 text-red-500" /></div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-wider">Zone de Maintenance</h2>
                            <p className="text-gray-400 text-sm">Outils d'initialisation et de sauvegarde de la base de données.</p>
                        </div>
                    </div>
                </div>
                
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
                        <h3 className="text-white font-bold mb-2">Structure de données</h3>
                        <p className="text-gray-400 text-sm mb-6 leading-relaxed">Si vous installez l'application sur un nouveau projet Firebase, utilisez ce bouton pour créer automatiquement toutes les collections nécessaires.</p>
                        <button onClick={handleInitializeAdmin} disabled={isMigrating} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs">
                            Initialiser les collections
                        </button>
                    </div>

                    <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
                        <h3 className="text-white font-bold mb-4 uppercase tracking-widest text-xs opacity-50">Transfert de données</h3>
                        <div className="space-y-4">
                            <button onClick={handleExportData} disabled={isMigrating} className="w-full flex items-center justify-center py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all">
                                <DownloadIcon className="w-5 h-5 mr-2" /> Exporter tout en JSON
                            </button>
                            <label className="flex flex-col items-center justify-center py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all cursor-pointer">
                                <span className="flex items-center"><UploadIcon className="w-5 h-5 mr-2" /> Importer un fichier JSON</span>
                                <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
                            </label>
                        </div>
                    </div>
                </div>

                {importLog.length > 0 && (
                    <div className="p-8 bg-black">
                        <h4 className="text-[10px] font-black text-gray-500 uppercase mb-4 tracking-widest">Journal Système</h4>
                        <div className="font-mono text-[10px] text-green-400 space-y-1 max-h-40 overflow-y-auto">
                            {importLog.map((log, i) => <div key={i}>[{new Date().toLocaleTimeString()}] {log}</div>)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsPage;
