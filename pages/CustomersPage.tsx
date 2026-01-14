
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Customer, Sale } from '../types';
import { PlusIcon, EditIcon, DeleteIcon, WhatsappIcon, EyeIcon, WarningIcon, SearchIcon } from '../constants';
import DropdownMenu, { DropdownMenuItem } from '../components/DropdownMenu';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal';

const CustomersPage: React.FC = () => {
    const { hasPermission } = useAuth();
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [balances, setBalances] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'debt' | 'exceeded'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [custSnap, salesSnap] = await Promise.all([
                getDocs(collection(db, "customers")),
                getDocs(collection(db, "sales"))
            ]);
            
            const customersData = custSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
            const salesData = salesSnap.docs.map(doc => doc.data() as Sale);

            const balanceMap: Record<string, number> = {};
            
            // On initialise avec le solde d'ouverture
            customersData.forEach(c => {
                balanceMap[c.id] = c.openingBalance || 0;
            });

            // On ajoute les factures et on retire les paiements
            salesData.forEach(sale => {
                const unpaid = sale.grandTotal - (sale.paidAmount || 0);
                balanceMap[sale.customerId] = (balanceMap[sale.customerId] || 0) + unpaid;
            });

            setCustomers(customersData);
            setBalances(balanceMap);
        } catch (err) {
            setError("Impossible de charger les clients.");
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => { fetchData(); }, []);

    const filteredCustomers = useMemo(() => {
        return customers.filter(c => {
            const balance = balances[c.id] || 0;
            const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.businessName?.toLowerCase().includes(searchTerm.toLowerCase()));
            if (filterType === 'debt') return matchesSearch && balance > 0.01;
            if (filterType === 'exceeded') return matchesSearch && c.isCreditLimited && c.creditLimit && balance > c.creditLimit;
            return matchesSearch;
        });
    }, [customers, balances, filterType, searchTerm]);

    const handleDelete = async (id: string) => {
        if (window.confirm("Supprimer ce client ?")) {
            try { await deleteDoc(doc(db, "customers", id)); await fetchData(); } 
            catch (err) { setError("Erreur de suppression."); }
        }
    };
    
    const handleBulkDelete = async () => {
        const batch = writeBatch(db);
        selectedIds.forEach(id => batch.delete(doc(db, 'customers', id)));
        await batch.commit();
        await fetchData();
        setSelectedIds([]);
        setIsBulkDeleteModalOpen(false);
    };

    const formatCurrency = (v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' FCFA';

    return (
        <div className="pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Gestion des Clients</h1>
                    <p className="text-gray-500 text-sm">Suivi des comptes et recouvrement des créances.</p>
                </div>
                {hasPermission('customers') && (
                    <div className="flex items-center space-x-2">
                        {selectedIds.length > 0 && (
                            <button onClick={() => setIsBulkDeleteModalOpen(true)} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold uppercase text-xs transition-all shadow-lg active:scale-95">
                                <DeleteIcon className="w-4 h-4 mr-2" />
                                Supprimer ({selectedIds.length})
                            </button>
                        )}
                        <button onClick={() => navigate('/customers/new')} className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-black uppercase text-xs shadow-xl transition-all hover:scale-[1.02] active:scale-95"><PlusIcon className="w-5 h-5 mr-2" />Nouveau client</button>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 mb-8 space-y-4">
                <div className="flex flex-col lg:flex-row gap-4 justify-between">
                    <div className="relative flex-1">
                        <input type="text" placeholder="Rechercher un client ou une entreprise..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-none focus:ring-2 focus:ring-primary-500 font-medium" />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIcon className="w-5 h-5"/></div>
                    </div>
                    <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-2xl self-start">
                        <button onClick={() => setFilterType('all')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filterType === 'all' ? 'bg-white dark:bg-gray-800 shadow-md text-primary-600' : 'text-gray-500'}`}>Tous</button>
                        <button onClick={() => setFilterType('debt')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filterType === 'debt' ? 'bg-white dark:bg-gray-800 shadow-md text-orange-600' : 'text-gray-500'}`}>Endettés</button>
                        <button onClick={() => setFilterType('exceeded')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filterType === 'exceeded' ? 'bg-white dark:bg-gray-800 shadow-md text-red-600' : 'text-gray-500'}`}>Risque Max</button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="p-24 text-center text-gray-400 font-black uppercase tracking-widest animate-pulse">Chargement de la base clients...</div>
            ) : (
            <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-primary-600 text-white">
                            <tr>
                                <th className="px-4 py-4 w-10 text-center"><input type="checkbox" onChange={e => setSelectedIds(e.target.checked ? filteredCustomers.map(c => c.id) : [])} className="h-4 w-4 text-primary-900 border-white rounded"/></th>
                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest">Identité / Entreprise</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest">Ouverture</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest">Limite Crédit</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest">Solde Actuel</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredCustomers.map(item => {
                                const currentBalance = balances[item.id] || 0;
                                const isExceeded = item.isCreditLimited && item.creditLimit && currentBalance > item.creditLimit;
                                return (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-4 py-4 text-center">
                                            <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds(prev => prev.includes(item.id) ? prev.filter(p => p !== item.id) : [...prev, item.id])} className="h-4 w-4 text-primary-600 rounded"/>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tighter">{item.name}</div>
                                            {item.businessName && <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.businessName}</div>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-500 dark:text-gray-400">
                                            {formatCurrency(item.openingBalance || 0)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {item.isCreditLimited ? (
                                                <div className="flex flex-col"><span className="text-[9px] font-black text-gray-400 uppercase">Plafond</span><span className="font-black text-gray-700 dark:text-gray-300">{formatCurrency(item.creditLimit || 0)}</span></div>
                                            ) : (
                                                <span className="text-[9px] text-gray-300 uppercase font-black italic">Sans Limite</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className={`inline-flex flex-col items-end px-3 py-1 rounded-xl ${isExceeded ? 'bg-red-600 text-white' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
                                                <span className={`text-sm font-black ${isExceeded ? 'text-white' : 'text-orange-600'}`}>{formatCurrency(currentBalance)}</span>
                                                {isExceeded && <span className="text-[8px] font-black text-white uppercase tracking-tighter">LIMITE DÉPASSÉE</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuItem onClick={() => navigate(`/customers/account/${item.id}`)}><EyeIcon className="w-4 h-4 mr-3 text-blue-500"/> Relevé Compte</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => navigate(`/customers/edit/${item.id}`)}><EditIcon className="w-4 h-4 mr-3"/> Modifier Profil</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-red-600 font-bold"><DeleteIcon className="w-4 h-4 mr-3"/> Supprimer</DropdownMenuItem>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            )}
        </div>
    );
};

export default CustomersPage;
