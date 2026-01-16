
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Supplier, Purchase, AppSettings } from '../types';
import { PlusIcon, EditIcon, DeleteIcon, EyeIcon, PrintIcon, SearchIcon } from '../constants';
import DropdownMenu, { DropdownMenuItem } from '../components/DropdownMenu';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal';
import { useReactToPrint } from 'react-to-print';
import { SupplierListPrint } from '../components/SupplierListPrint';

const SuppliersPage: React.FC = () => {
    const { hasPermission } = useAuth();
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [balances, setBalances] = useState<Record<string, number>>({});
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCity, setSelectedCity] = useState('all');
    const [filterType, setFilterType] = useState<'all' | 'debt'>('all');

    // Printing
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({ contentRef: printRef });

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [suppliersSnap, purchasesSnap, paymentsSnap, settingsSnap] = await Promise.all([
                getDocs(collection(db, "suppliers")),
                getDocs(collection(db, "purchases")),
                getDocs(collection(db, "purchasePayments")),
                getDocs(collection(db, "appSettings"))
            ]);
            
            if (!settingsSnap.empty) {
                setSettings({ id: settingsSnap.docs[0].id, ...settingsSnap.docs[0].data() } as AppSettings);
            }

            const suppliersData = suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
            const purchasesData = purchasesSnap.docs.map(doc => doc.data() as Purchase);
            const paymentsData = paymentsSnap.docs.map(doc => doc.data());

            const balanceMap: Record<string, number> = {};

            // 1. Initialiser avec Solde Ouverture
            suppliersData.forEach(s => {
                balanceMap[s.id] = s.openingBalance || 0;
            });

            // 2. Soustraire paiements sur ouverture
            paymentsData.forEach(p => {
                const purchaseId = p.purchaseId as string;
                if (purchaseId && purchaseId.startsWith('OPENING_BALANCE_')) {
                    const supplierId = purchaseId.replace('OPENING_BALANCE_', '');
                    if (balanceMap[supplierId] !== undefined) {
                        balanceMap[supplierId] -= (p.amount || 0);
                    }
                }
            });

            // 3. Ajouter dettes achats (Non payés)
            purchasesData.forEach(purchase => {
                const unpaid = purchase.grandTotal - (purchase.paidAmount || 0);
                balanceMap[purchase.supplierId] = (balanceMap[purchase.supplierId] || 0) + unpaid;
            });

            // 4. Nettoyer négatifs
            Object.keys(balanceMap).forEach(key => {
                if (balanceMap[key] < 0) balanceMap[key] = 0;
            });

            setSuppliers(suppliersData);
            setBalances(balanceMap);
        } catch (err) {
            setError("Impossible de charger les fournisseurs.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const cities = useMemo(() => {
        const uniqueCities = new Set(suppliers.map(s => s.city).filter(Boolean));
        return Array.from(uniqueCities as Set<string>).sort();
    }, [suppliers]);

    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(s => {
            const balance = balances[s.id] || 0;
            const term = searchTerm.toLowerCase();
            const matchesSearch = s.name.toLowerCase().includes(term) || (s.businessName && s.businessName.toLowerCase().includes(term));
            const matchesCity = selectedCity === 'all' || s.city === selectedCity;

            if (!matchesCity) return false;

            if (filterType === 'debt') return matchesSearch && balance > 0.01;
            return matchesSearch;
        });
    }, [suppliers, balances, filterType, searchTerm, selectedCity]);

    const formatCurrency = (v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' FCFA';

    const handleDelete = async (id: string) => {
        if (window.confirm("Supprimer ce fournisseur ?")) {
            try { await deleteDoc(doc(db, "suppliers", id)); await fetchData(); } 
            catch (err) { setError("Erreur de suppression."); }
        }
    };

    const handleBulkDelete = async () => {
        const batch = writeBatch(db);
        selectedIds.forEach(id => batch.delete(doc(db, 'suppliers', id)));
        await batch.commit();
        await fetchData();
        setSelectedIds([]);
        setIsBulkDeleteModalOpen(false);
    };

    const handleSelectOne = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(suppliers.map(s => s.id));
        } else {
            setSelectedIds([]);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Gestion des Fournisseurs</h1>
                {hasPermission('suppliers') && (
                    <div className="flex items-center space-x-2">
                        {selectedIds.length > 0 && (
                            <button onClick={() => setIsBulkDeleteModalOpen(true)} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                                <DeleteIcon className="w-5 h-5 mr-2" />
                                Supprimer ({selectedIds.length})
                            </button>
                        )}
                        <button onClick={() => navigate('/suppliers/new')} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-bold uppercase text-sm"><PlusIcon className="w-5 h-5 mr-2" />Nouveau fournisseur</button>
                    </div>
                )}
            </div>
            {error && <p className="mb-4 text-sm text-red-600 bg-red-100 p-2 rounded-md">{error}</p>}
            
            <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative">
                        <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl border-none focus:ring-2 focus:ring-primary-500 font-medium" />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIcon className="w-4 h-4"/></div>
                    </div>
                    <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 font-bold">
                        <option value="all">Toutes les villes</option>
                        {cities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 font-bold">
                        <option value="all">Tous les fournisseurs</option>
                        <option value="debt">Dettes à payer</option>
                    </select>
                    <button onClick={() => setIsPrintModalOpen(true)} className="px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-black font-bold uppercase text-xs shadow-lg flex items-center justify-center transition-all hover:scale-105">
                        <PrintIcon className="w-4 h-4 mr-2" /> Imprimer
                    </button>
                </div>
            </div>

            {loading ? <p>Chargement...</p> : (
            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl border border-gray-100 dark:border-gray-700">
                <div className="overflow-x-auto rounded-2xl">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-primary-600"><tr>
                            <th className="px-4 py-3"><input type="checkbox" onChange={handleSelectAll} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"/></th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">Identité / Entreprise</th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">Contact</th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">RCCM / NIF</th>
                            <th className="px-6 py-3 text-right text-[10px] font-black text-white uppercase tracking-widest">Solde (Dette)</th>
                            <th className="px-6 py-3 text-right text-[10px] font-black text-white uppercase tracking-widest">Actions</th>
                        </tr></thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredSuppliers.map(item => {
                                const balance = balances[item.id] || 0;
                                return (
                                <tr key={item.id} className={selectedIds.includes(item.id) ? 'bg-primary-50 dark:bg-gray-700/50' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors'}>
                                <td className="px-4 py-4"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => handleSelectOne(item.id)} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"/></td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-bold text-gray-900 dark:text-white uppercase">{item.businessName || item.name}</div>
                                    {item.businessName && <div className="text-[10px] font-black text-gray-400 uppercase">{item.name}</div>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 font-medium">
                                    <div>{item.phone}</div>
                                    <div className="text-[10px] font-bold text-primary-600">{item.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 font-bold">
                                    <div className="uppercase">{item.rccm || '-'}</div>
                                    <div className="text-[10px] uppercase">{item.nif || '-'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <div className={`inline-flex px-3 py-1 rounded-xl ${balance > 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                                        <span className="text-sm font-black">{formatCurrency(balance)}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {hasPermission('suppliers') && (
                                        <DropdownMenu>
                                            <DropdownMenuItem onClick={() => navigate(`/suppliers/account/${item.id}`)}>
                                                <EyeIcon className="w-4 h-4 mr-3 text-blue-500"/> Compte Fournisseur
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => navigate(`/suppliers/edit/${item.id}`)}>
                                                <EditIcon className="w-4 h-4 mr-3"/> Modifier Profil
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-red-600 font-bold">
                                                <DeleteIcon className="w-4 h-4 mr-3"/> Supprimer
                                            </DropdownMenuItem>
                                        </DropdownMenu>
                                    )}
                                </td></tr>
                            );})}
                        </tbody>
                        <tfoot className="border-t-2 border-gray-200 dark:border-gray-700">
                            <tr className="bg-blue-100 dark:bg-blue-900/40">
                                <td colSpan={4} className="px-6 py-4 text-right text-xs font-black uppercase text-primary-600 tracking-widest">Total Global Dettes (Fournisseurs)</td>
                                <td className="px-6 py-4 text-right text-sm font-black text-red-600">
                                    {formatCurrency(Object.values(balances).reduce((a, b) => a + b, 0))}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            )}
             <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} title="Confirmer la suppression">
                <div className="p-6"><p>Êtes-vous sûr de vouloir supprimer les {selectedIds.length} fournisseurs sélectionnés ?</p></div>
                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button onClick={handleBulkDelete} className="bg-red-600 text-white px-4 py-2 rounded">Supprimer</button>
                    <button onClick={() => setIsBulkDeleteModalOpen(false)} className="ml-2 px-4 py-2 bg-gray-200 rounded">Annuler</button>
                </div>
            </Modal>

            <Modal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} title="IMPRIMER LISTE FOURNISSEURS" maxWidth="max-w-4xl">
                <div className="flex flex-col items-center p-6">
                    <div className="w-full overflow-auto bg-gray-100 dark:bg-gray-700 p-4 rounded-xl mb-6 shadow-inner max-h-[70vh]">
                        <div className="transform scale-90 origin-top">
                             <SupplierListPrint 
                                ref={printRef}
                                suppliers={filteredSuppliers}
                                balances={balances}
                                settings={settings}
                             />
                        </div>
                    </div>
                    <div className="flex gap-4 w-full justify-end">
                        <button onClick={() => setIsPrintModalOpen(false)} className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-bold uppercase">Fermer</button>
                        <button onClick={handlePrint} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase shadow-lg flex items-center"><PrintIcon className="w-5 h-5 mr-2" /> Imprimer</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SuppliersPage;
