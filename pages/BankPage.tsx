
import React, { useState, useEffect, useMemo } from 'react';
import { db, storage } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { BankTransaction, AppSettings } from '../types';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal';
import { PlusIcon, DeleteIcon, SearchIcon, BankIcon, SettingsIcon, TrendingUpIcon, DocumentTextIcon, PrintIcon } from '../constants';
import { useReactToPrint } from 'react-to-print';
import { BankTransactionNote } from '../components/BankTransactionNote';

const BankPage: React.FC = () => {
    const { user, hasPermission } = useAuth();
    const [transactions, setTransactions] = useState<BankTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Print
    const [transactionToPrint, setTransactionToPrint] = useState<BankTransaction | null>(null);
    const printRef = React.useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        onAfterPrint: () => setTransactionToPrint(null),
    });

    useEffect(() => {
        if (transactionToPrint) {
            handlePrint();
        }
    }, [transactionToPrint]);

    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    // Modals
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    // Forms
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [newTransaction, setNewTransaction] = useState<Partial<BankTransaction>>({
        type: 'deposit',
        amount: 0,
        description: '',
        reference: '',
        date: new Date().toISOString().split('T')[0],
        category: 'Autre'
    });

    const [openingBalanceForm, setOpeningBalanceForm] = useState({
        amount: 0,
        date: ''
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Settings
            const settingsSnap = await getDoc(doc(db, 'settings', 'app-config'));
            if (settingsSnap.exists()) {
                const data = { id: settingsSnap.id, ...settingsSnap.data() } as AppSettings;
                setSettings(data);
                setOpeningBalanceForm({
                    amount: data.bankOpeningBalance || 0,
                    date: data.bankOpeningBalanceDate || new Date().toISOString().split('T')[0]
                });
            }

            // Fetch Transactions
            const q = query(collection(db, 'bankTransactions'), orderBy('date', 'desc'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BankTransaction));
            setTransactions(data);
        } catch (err) {
            console.error(err);
            setError("Erreur lors du chargement des données bancaires.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAddTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null); // Réinitialiser les erreurs

        // 1. Vérification Utilisateur
        if (!user || !user.uid) {
            setError("Utilisateur non authentifié. Veuillez vous reconnecter.");
            return;
        }
        
        // 2. Conversion et Validation Montant
        const amountVal = parseFloat(String(newTransaction.amount || '0'));
        if (isNaN(amountVal) || amountVal <= 0) {
            setError("Le montant doit être un nombre positif.");
            return;
        }

        // 3. Validation Description
        if (!newTransaction.description?.trim()) {
            setError("La description est obligatoire.");
            return;
        }

        setLoading(true);
        console.log("Début de l'enregistrement de la transaction...");

        try {
            let attachmentUrl = '';
            
            // 4. Upload Fichier (si présent)
            if (attachmentFile) {
                console.log("Fichier détecté, tentative d'upload...", attachmentFile.name);
                try {
                    const storageRef = ref(storage, `bank_attachments/${Date.now()}_${attachmentFile.name}`);
                    
                    // Ajout d'un timeout pour l'upload (10 secondes)
                    const uploadPromise = uploadBytes(storageRef, attachmentFile);
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error("Délai d'attente dépassé pour l'envoi du fichier (10s). Vérifiez votre connexion.")), 10000)
                    );

                    await Promise.race([uploadPromise, timeoutPromise]);
                    console.log("Upload réussi, récupération URL...");
                    
                    attachmentUrl = await getDownloadURL(storageRef);
                    console.log("URL fichier obtenue:", attachmentUrl);
                } catch (uploadErr: any) {
                    console.error("Erreur Upload:", uploadErr);
                    // On demande à l'utilisateur s'il veut continuer sans fichier
                    if (!window.confirm(`L'envoi du fichier a échoué : ${uploadErr.message}.\nVoulez-vous continuer l'enregistrement SANS la pièce jointe ?`)) {
                        setLoading(false);
                        return; // On arrête tout si l'utilisateur dit Non
                    }
                    // Sinon on continue avec attachmentUrl vide
                }
            }

            // 5. Enregistrement Firestore
            console.log("Enregistrement dans Firestore...");
            
            // Timeout pour Firestore aussi (10s)
            const docData = {
                ...newTransaction,
                amount: amountVal,
                description: newTransaction.description.trim(),
                reference: newTransaction.reference?.trim() || '',
                category: newTransaction.category?.trim() || 'Autre',
                attachmentUrl,
                createdByUserId: user.uid,
                createdAt: new Date().toISOString()
            };

            const firestorePromise = addDoc(collection(db, 'bankTransactions'), docData);
            const firestoreTimeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Délai d'attente dépassé pour la base de données (10s).")), 10000)
            );

            await Promise.race([firestorePromise, firestoreTimeoutPromise]);
            console.log("Transaction enregistrée avec succès !");

            // 6. Succès & Reset
            setIsTransactionModalOpen(false);
            setNewTransaction({
                type: 'deposit',
                amount: 0,
                description: '',
                reference: '',
                date: new Date().toISOString().split('T')[0],
                category: 'Autre'
            });
            setAttachmentFile(null);
            fetchData();
        } catch (err: any) {
            console.error("Erreur Globale Transaction:", err);
            setError(`Échec de l'enregistrement : ${err.message || 'Erreur inconnue'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateDoc(doc(db, 'settings', 'app-config'), {
                bankOpeningBalance: parseFloat(openingBalanceForm.amount.toString()),
                bankOpeningBalanceDate: openingBalanceForm.date
            });
            setIsSettingsModalOpen(false);
            fetchData();
        } catch (err) {
            setError("Erreur lors de la mise à jour du solde d'ouverture.");
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Voulez-vous vraiment supprimer cette transaction ?')) {
            try {
                await deleteDoc(doc(db, 'bankTransactions', id));
                fetchData();
            } catch (err) {
                setError("Erreur lors de la suppression.");
            }
        }
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';

    // Calculations
    const sortedTransactions = useMemo(() => {
        return [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transactions]);

    const runningBalanceData = useMemo(() => {
        let balance = settings?.bankOpeningBalance || 0;
        const openingDate = settings?.bankOpeningBalanceDate ? new Date(settings.bankOpeningBalanceDate) : null;

        return sortedTransactions.map(t => {
            // Only count transactions after opening date if strictly enforced, but usually we just sum all if no date logic conflict.
            // For simplicity, we assume opening balance is the start, and we add all transactions.
            // Ideally, transactions before opening date shouldn't exist or shouldn't count if opening balance is a "reset".
            // Let's assume opening balance is "initial capital" and all recorded transactions follow it.
            
            if (t.type === 'deposit') balance += t.amount;
            else balance -= t.amount;
            
            return { ...t, balance };
        }).reverse(); // Reverse back for display (newest first)
    }, [sortedTransactions, settings]);

    const filteredTransactions = useMemo(() => {
        return runningBalanceData.filter(t => {
            const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  t.reference?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesDate = (!dateRange.start || t.date >= dateRange.start) && 
                                (!dateRange.end || t.date <= dateRange.end);
            return matchesSearch && matchesDate;
        });
    }, [runningBalanceData, searchTerm, dateRange]);

    const stats = useMemo(() => {
        const currentBalance = runningBalanceData.length > 0 ? runningBalanceData[0].balance : (settings?.bankOpeningBalance || 0);
        const totalDeposits = transactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0);
        const totalWithdrawals = transactions.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0);
        return { currentBalance, totalDeposits, totalWithdrawals };
    }, [runningBalanceData, transactions, settings]);

    return (
        <div className="pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center">
                        <BankIcon className="w-8 h-8 mr-3 text-blue-600" />
                        Gestion Banque
                    </h1>
                    <p className="text-gray-500 text-sm">Suivi des mouvements bancaires et trésorerie.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <button onClick={() => setIsSettingsModalOpen(true)} className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-bold uppercase text-xs transition-colors">
                        <SettingsIcon className="w-5 h-5 mr-2" />
                        Config. Solde
                    </button>
                    <button onClick={() => setIsTransactionModalOpen(true)} className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-black uppercase text-xs shadow-xl transition-transform active:scale-95">
                        <PlusIcon className="w-5 h-5 mr-2" />
                        Nouvelle Opération
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-blue-100 dark:border-gray-700 relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Solde Actuel</p>
                        <h3 className={`text-3xl font-black ${stats.currentBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(stats.currentBalance)}</h3>
                    </div>
                    <div className="absolute right-[-20px] top-[-20px] opacity-10">
                        <BankIcon className="w-32 h-32 text-blue-600" />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-green-100 dark:border-gray-700">
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Total Entrées</p>
                    <h3 className="text-3xl font-black text-green-600">+{formatCurrency(stats.totalDeposits)}</h3>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-red-100 dark:border-gray-700">
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Total Sorties</p>
                    <h3 className="text-3xl font-black text-red-600">-{formatCurrency(stats.totalWithdrawals)}</h3>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative md:col-span-2">
                        <input 
                            type="text" 
                            placeholder="Rechercher description, référence..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl border-none focus:ring-2 focus:ring-blue-500 font-medium" 
                        />
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                    <input 
                        type="date" 
                        value={dateRange.start} 
                        onChange={e => setDateRange({...dateRange, start: e.target.value})} 
                        className="px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 font-bold"
                    />
                    <input 
                        type="date" 
                        value={dateRange.end} 
                        onChange={e => setDateRange({...dateRange, end: e.target.value})} 
                        className="px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 font-bold"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-blue-600 text-white">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest">Date</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest">Type</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest">Description / Réf</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest">Débit (-)</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest">Crédit (+)</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest bg-blue-700">Solde</th>
                                <th className="px-6 py-4 text-right w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredTransactions.map((t) => (
                                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-600 dark:text-gray-300">
                                        {new Date(t.date).toLocaleDateString('fr-FR')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${t.type === 'deposit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {t.type === 'deposit' ? 'Versement' : 'Retrait'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-bold text-gray-900 dark:text-white">{t.description}</div>
                                        {t.reference && <div className="text-xs text-gray-500 uppercase font-mono">{t.reference}</div>}
                                        {t.category && <div className="text-[10px] text-blue-500 font-bold mt-1 bg-blue-50 inline-block px-2 py-0.5 rounded">{t.category}</div>}
                                        {t.attachmentUrl && (
                                            <a href={t.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center text-[10px] text-gray-500 hover:text-blue-600 mt-1">
                                                <DocumentTextIcon className="w-3 h-3 mr-1" />
                                                Voir Bordereau
                                            </a>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-red-600">
                                        {t.type === 'withdrawal' ? formatCurrency(t.amount) : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-green-600">
                                        {t.type === 'deposit' ? formatCurrency(t.amount) : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right font-black text-gray-800 dark:text-white bg-gray-50 dark:bg-gray-900/20">
                                        {formatCurrency(t.balance)}
                                    </td>
                                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                        <button onClick={() => setTransactionToPrint(t)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Imprimer Bordereau">
                                            <PrintIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleDelete(t.id)} className="text-red-400 hover:text-red-600 transition-colors">
                                            <DeleteIcon className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredTransactions.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 font-medium">Aucune transaction trouvée</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: New Transaction */}
            <Modal isOpen={isTransactionModalOpen} onClose={() => setIsTransactionModalOpen(false)} title="Nouvelle Opération Bancaire">
                <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-1 text-gray-700">Type d'opération</label>
                            <select 
                                value={newTransaction.type} 
                                onChange={e => setNewTransaction({...newTransaction, type: e.target.value as 'deposit' | 'withdrawal'})}
                                className="w-full p-3 border rounded-xl bg-gray-50 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="deposit">Versement (Crédit +)</option>
                                <option value="withdrawal">Retrait (Débit -)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1 text-gray-700">Montant</label>
                            <input 
                                type="number" 
                                min="0" 
                                step="1" 
                                value={newTransaction.amount || ''} 
                                onChange={e => setNewTransaction({...newTransaction, amount: e.target.value ? parseFloat(e.target.value) : 0})}
                                className="w-full p-3 border rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1 text-gray-700">Date</label>
                        <input 
                            type="date" 
                            value={newTransaction.date} 
                            onChange={e => setNewTransaction({...newTransaction, date: e.target.value})}
                            className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1 text-gray-700">Description</label>
                        <input 
                            type="text" 
                            value={newTransaction.description} 
                            onChange={e => setNewTransaction({...newTransaction, description: e.target.value})}
                            placeholder="Ex: Versement Client X, Paiement Loyer..."
                            className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-1 text-gray-700">Référence (Optionnel)</label>
                            <input 
                                type="text" 
                                value={newTransaction.reference} 
                                onChange={e => setNewTransaction({...newTransaction, reference: e.target.value})}
                                placeholder="N° Chèque, Bordereau..."
                                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1 text-gray-700">Catégorie</label>
                            <input 
                                type="text" 
                                value={newTransaction.category} 
                                onChange={e => setNewTransaction({...newTransaction, category: e.target.value})}
                                list="categories-list"
                                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <datalist id="categories-list">
                                <option value="Ventes" />
                                <option value="Achats" />
                                <option value="Charges" />
                                <option value="Salaires" />
                                <option value="Autre" />
                            </datalist>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1 text-gray-700">Pièce jointe (Bordereau)</label>
                        <input 
                            type="file" 
                            onChange={e => setAttachmentFile(e.target.files ? e.target.files[0] : null)}
                            className="w-full p-2 border rounded-xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={() => setIsTransactionModalOpen(false)} className="px-6 py-3 rounded-xl bg-gray-100 font-bold text-gray-600 hover:bg-gray-200">Annuler</button>
                        <button type="submit" disabled={loading} className={`px-6 py-3 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 shadow-lg ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {loading ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal: Settings (Opening Balance) */}
            <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Configuration Solde Initial">
                <form onSubmit={handleUpdateSettings} className="p-6 space-y-4">
                    <p className="text-sm text-gray-500 mb-4 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        Le solde d'ouverture est le montant disponible sur le compte avant la première opération enregistrée dans ce logiciel.
                    </p>
                    <div>
                        <label className="block text-sm font-bold mb-1 text-gray-700">Montant Solde d'Ouverture</label>
                        <input 
                            type="number" 
                            step="1" 
                            value={openingBalanceForm.amount || ''} 
                            onChange={e => setOpeningBalanceForm({...openingBalanceForm, amount: parseFloat(e.target.value) || 0})}
                            className="w-full p-3 border rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1 text-gray-700">Date du Solde d'Ouverture</label>
                        <input 
                            type="date" 
                            value={openingBalanceForm.date} 
                            onChange={e => setOpeningBalanceForm({...openingBalanceForm, date: e.target.value})}
                            className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={() => setIsSettingsModalOpen(false)} className="px-6 py-3 rounded-xl bg-gray-100 font-bold text-gray-600 hover:bg-gray-200">Annuler</button>
                        <button type="submit" className="px-6 py-3 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 shadow-lg">Mettre à jour</button>
                    </div>
                </form>
            </Modal>

            {/* Hidden Print Component */}
            <div className="hidden">
                {transactionToPrint && (
                    <BankTransactionNote 
                        ref={printRef} 
                        transaction={transactionToPrint} 
                        settings={settings} 
                    />
                )}
            </div>
        </div>
    );
};

export default BankPage;
