import React, { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../supabase';
import { AppSettings } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { UploadIcon, DownloadIcon, ShieldCheckIcon, ImageIcon, DatabaseIcon } from '../constants';
import { normalizePhoneNumber, formatPhoneNumberDisplay } from '../utils/whatsappUtils';

const initialSettings: AppSettings = {
    id: 'app-config',
    companyName: 'ETS COUL & FRERES',
    companyAddress: 'Cotonou, Bénin',
    companyPhone: '+229 00 00 00 00',
    companyEmail: 'contact@coulfreres.com',
    companyContact: 'Direction',
    companyRCCM: 'RB/COT/24 B 0000',
    companyLogoUrl: '',
    currencySymbol: 'FCFA',
    invoiceFooterText: 'Merci de votre confiance. Les marchandises vendues ne sont ni reprises ni échangées.',
    saleInvoicePrefix: 'VNT-',
    purchaseInvoicePrefix: 'ACH-',
    defaultTaxRate: 0,
    defaultPosCustomerId: 'walkin',
    themeColor: 'teal',
};

const SettingsPage: React.FC = () => {
    const { hasPermission } = useAuth();
    const { setTheme, availableThemes, refreshSettings: refreshThemeSettings } = useTheme();

    const [settings, setSettings] = useState<AppSettings>(initialSettings);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isMigrating, setIsMigrating] = useState(false);
    const [importLog, setImportLog] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    
    useEffect(() => {
        refreshSettings();
    }, []);

    const refreshSettings = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('app_settings').select('*').eq('id', 'app-config').single();

            if (!error && data) {
                const loadedSettings = data as AppSettings;
                setSettings(loadedSettings);
                setTheme(loadedSettings.themeColor || 'teal');
                if (loadedSettings.companyLogoUrl) {
                    setLogoPreview(loadedSettings.companyLogoUrl);
                }
            } else {
                await supabase.from('app_settings').upsert(initialSettings);
                setSettings(initialSettings);
            }
        } catch (err: any) {
            console.error("Erreur settings:", err);
            setError("Impossible de charger les paramètres.");
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumber = ['defaultTaxRate'].includes(name);
        setSettings(prev => ({ ...prev, [name]: isNumber ? parseFloat(value) || 0 : value }));
    };

    const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const cleanValue = value.replace(/[^0-9\s+]/g, '');
        setSettings(prev => ({ ...prev, companyWhatsapp: cleanValue }));
    };

    const handleWhatsappBlur = () => {
        if (settings.companyWhatsapp) {
            const formatted = formatPhoneNumberDisplay(settings.companyWhatsapp);
            setSettings(prev => ({ ...prev, companyWhatsapp: formatted }));
        }
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
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setLogoPreview(base64String);
                setSettings(prev => ({ ...prev, companyLogoUrl: base64String }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const { error } = await supabase.from('app_settings').upsert(settings);
            if (error) throw error;
            
            refreshThemeSettings();
            
            setSuccess("Paramètres enregistrés avec succès !");
            setTimeout(() => setSuccess(null), 3000);
            await refreshSettings();
        } catch (err: any) {
            console.error("Erreur enregistrement settings:", err);
            setError(`Erreur d'enregistrement : ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleExport = async () => {
        setIsMigrating(true);
        setImportLog(["🚀 Préparation de l'exportation..."]);
        try {
            const tablesToExport = [
                'app_settings', 'categories', 'brands', 'units', 'warehouses', 
                'products', 'customers', 'suppliers', 'sales', 'sale_items', 'sale_payments', 
                'purchases', 'purchase_items', 'purchase_payments', 'stock_adjustments', 
                'warehouse_transfers', 'users', 'roles', 'credit_notes', 'supplier_credit_notes',
                'bank_transactions'
            ];

            const fullData: any = {};
            
            for (const tableName of tablesToExport) {
                setImportLog(prev => [...prev, `📥 Lecture de la table ${tableName}...`]);
                try {
                    const { data, error } = await supabase.from(tableName).select('*');
                    if (error) throw error;
                    fullData[tableName] = data;
                } catch (error: any) {
                    console.error(`Erreur lecture ${tableName}:`, error);
                    setImportLog(prev => [...prev, `⚠️ Erreur sur ${tableName}: ${error.message}`]);
                    continue;
                }
            }

            const dataStr = JSON.stringify(fullData, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', `BACKUP_COUL_FRERES_${new Date().toISOString().split('T')[0]}.json`);
            linkElement.click();
            
            setImportLog(prev => [...prev, "✅ Exportation terminée !"]);
            setSuccess("Export réussi.");
        } catch (err: any) {
            setError(`Erreur export : ${err.message}`);
        } finally {
            setIsMigrating(false);
        }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!window.confirm("ATTENTION : Cette opération va importer des données et écraser les existantes. Assurez-vous d'avoir une sauvegarde. Continuer ?")) {
            event.target.value = '';
            return;
        }

        setIsMigrating(true);
        setImportLog(["🚀 Démarrage de l'import..."]);
        setError(null);
        setSuccess(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);
                
                let processedTables = 0;
                let importedItems = 0;
                let totalItems = 0;

                 for (const tableName of Object.keys(data)) {
                    if (Array.isArray(data[tableName])) {
                        totalItems += data[tableName].length;
                    }
                }
                setImportLog(prev => [...prev, `📦 Fichier analysé : ${totalItems} éléments trouvés.`]);

                for (const tableName of Object.keys(data)) {
                    const rows = data[tableName];
                    if (!Array.isArray(rows) || rows.length === 0) continue;

                    setImportLog(prev => [...prev, `📤 Importation de ${rows.length} entrées dans ${tableName}...`]);

                    const { error } = await supabase.from(tableName).upsert(rows);
                    
                    if (error) {
                        console.error(`Erreur import ${tableName}:`, error);
                        setImportLog(prev => [...prev, `⚠️ Erreur sur ${tableName}: ${error.message}`]);
                    } else {
                        importedItems += rows.length;
                        setImportLog(prev => [...prev, `✅ ${tableName} traité.`]);
                        processedTables++;
                    }
                }

                setImportLog(prev => [...prev, "🏁 Import terminé !"]);
                setSuccess("Importation terminée.");
                
                 const report = [
                    "✅ IMPORTATION TERMINÉE",
                    "----------------------------------------",
                    `📅 Date : ${new Date().toLocaleString()}`,
                    `📂 Tables traitées : ${processedTables}`,
                    `📝 Éléments importés : ${importedItems}/${totalItems}`,
                    "----------------------------------------",
                    "Le système va redémarrer dans quelques secondes..."
                ];
                setImportLog(prev => [...prev, ...report]);

                setTimeout(() => window.location.reload(), 2000);

            } catch (err: any) {
                console.error(err);
                setError(`Erreur lors de l'import : ${err.message}`);
                setImportLog(prev => [...prev, `❌ CRASH : ${err.message}`]);
            } finally {
                setIsMigrating(false);
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    if (loading && !settings.companyName) {
        return <div className="p-8 text-center">Chargement des paramètres...</div>;
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <span className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg text-indigo-600 dark:text-indigo-400">
                        ⚙️
                    </span>
                    Paramètres
                </h1>
                
                {hasPermission('admin') && (
                     <div className="flex gap-2">
                        {/* Maintenance actions are in the maintenance card */}
                     </div>
                )}
            </div>

            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
                    <p>{error}</p>
                </div>
            )}

            {success && (
                <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4" role="alert">
                    <p>{success}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Colonne Gauche : Formulaire */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Carte : Identité de l'entreprise */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200 border-b pb-2">
                            Identité de l'entreprise
                        </h2>
                        <form onSubmit={handleSave}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="col-span-2 flex justify-center mb-4">
                                    <div className="relative group">
                                        <div className="w-32 h-32 rounded-full border-4 border-indigo-100 dark:border-indigo-900 overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                            {logoPreview ? (
                                                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                                            ) : (
                                                <ImageIcon className="w-12 h-12 text-gray-400" />
                                            )}
                                        </div>
                                        <label htmlFor="logo-upload" className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full cursor-pointer hover:bg-indigo-700 shadow-lg transform transition-transform hover:scale-110">
                                            <UploadIcon className="w-4 h-4" />
                                            <input 
                                                id="logo-upload" 
                                                type="file" 
                                                accept="image/*" 
                                                className="hidden" 
                                                onChange={handleLogoChange}
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom de l'entreprise</label>
                                    <input
                                        type="text"
                                        name="companyName"
                                        value={settings.companyName}
                                        onChange={handleInputChange}
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Téléphone</label>
                                    <input
                                        type="text"
                                        name="companyPhone"
                                        value={settings.companyPhone}
                                        onChange={handleInputChange}
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">WhatsApp (Admin)</label>
                                    <input
                                        type="tel"
                                        name="companyWhatsapp"
                                        value={settings.companyWhatsapp || ''}
                                        onChange={handleWhatsappChange}
                                        onBlur={handleWhatsappBlur}
                                        placeholder="ex: 229XXXXXXXX"
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                    {settings.companyWhatsapp && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Numéro international : <span className="font-mono font-semibold">+{normalizePhoneNumber(settings.companyWhatsapp)}</span>
                                        </p>
                                    )}
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adresse</label>
                                    <textarea
                                        name="companyAddress"
                                        value={settings.companyAddress}
                                        onChange={handleInputChange}
                                        rows={3}
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                    <input
                                        type="email"
                                        name="companyEmail"
                                        value={settings.companyEmail}
                                        onChange={handleInputChange}
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">RCCM / N° Fiscal</label>
                                    <input
                                        type="text"
                                        name="companyRCCM"
                                        value={settings.companyRCCM}
                                        onChange={handleInputChange}
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                            </div>

                             <h2 className="text-lg font-semibold mt-8 mb-4 text-gray-700 dark:text-gray-200 border-b pb-2">
                                Configuration Système
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Devise</label>
                                    <input
                                        type="text"
                                        name="currencySymbol"
                                        value={settings.currencySymbol}
                                        onChange={handleInputChange}
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Taux de TVA par défaut (%)</label>
                                    <input
                                        type="number"
                                        name="defaultTaxRate"
                                        value={settings.defaultTaxRate}
                                        onChange={handleInputChange}
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        step="0.01"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Préfixe Vente</label>
                                    <input
                                        type="text"
                                        name="saleInvoicePrefix"
                                        value={settings.saleInvoicePrefix}
                                        onChange={handleInputChange}
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Préfixe Achat</label>
                                    <input
                                        type="text"
                                        name="purchaseInvoicePrefix"
                                        value={settings.purchaseInvoicePrefix}
                                        onChange={handleInputChange}
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pied de page facture</label>
                                    <textarea
                                        name="invoiceFooterText"
                                        value={settings.invoiceFooterText}
                                        onChange={handleInputChange}
                                        rows={2}
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className={`px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center gap-2 ${isSaving ? 'opacity-75 cursor-not-allowed' : ''}`}
                                >
                                    {isSaving ? (
                                        <>
                                            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                                            Enregistrement...
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheckIcon className="w-5 h-5" />
                                            Enregistrer les paramètres
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Colonne Droite : Thème & Maintenance */}
                <div className="space-y-6">
                    {/* Carte : Thème */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200 border-b pb-2">
                            Apparence
                        </h2>
                        <div className="grid grid-cols-4 gap-2">
                            {Object.entries(availableThemes).map(([name, colorClass]) => (
                                <button
                                    key={name}
                                    onClick={() => handleThemeChange(name)}
                                    className={`w-full aspect-square rounded-lg shadow-sm border-2 transition-all ${settings.themeColor === name ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-105'}`}
                                    style={{ backgroundColor: `rgb(${colorClass[500]})` }}
                                    title={name}
                                />
                            ))}
                        </div>
                        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            Thème actuel : <span className="font-semibold capitalize">{settings.themeColor}</span>
                        </p>
                    </div>

                    {/* Carte : Maintenance (Admin Only) */}
                    {hasPermission('admin') && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-t-4 border-yellow-500">
                            <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                <DatabaseIcon className="w-5 h-5 text-yellow-500" />
                                Zone de Maintenance
                            </h2>
                            
                            <div className="space-y-4">
                                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                                    <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Sauvegarde & Restauration</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                        Exportez ou importez vos données au format JSON.
                                    </p>
                                    
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={handleExport}
                                            disabled={isMigrating}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                                        >
                                            <DownloadIcon className="w-4 h-4" /> Exporter Données (JSON)
                                        </button>
                                        
                                        <label className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm cursor-pointer">
                                            <UploadIcon className="w-4 h-4" /> Importer Données (JSON)
                                            <input 
                                                type="file" 
                                                accept=".json" 
                                                className="hidden" 
                                                onChange={handleImport}
                                                disabled={isMigrating}
                                            />
                                        </label>
                                    </div>
                                </div>

                                {isMigrating && (
                                    <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs font-mono max-h-48 overflow-y-auto">
                                        {importLog.map((log, i) => (
                                            <div key={i} className="mb-1">{log}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
