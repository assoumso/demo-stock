
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Customer, Sale, AppSettings, SalePayment, Payment, CreditNote } from '../types';
import { PlusIcon, EditIcon, DeleteIcon, WhatsappIcon, EyeIcon, WarningIcon, SearchIcon, PrintIcon } from '../constants';
import DropdownMenu, { DropdownMenuItem } from '../components/DropdownMenu';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../context/DataContext';
import Modal from '../components/Modal';
import { useReactToPrint } from 'react-to-print';
import { CustomerListPrint } from '../components/CustomerListPrint';
import { formatCurrency } from '../utils/formatters';

import { Pagination } from '../components/Pagination';
import * as ReactWindow from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
const List = (ReactWindow as any).FixedSizeList;
const AutoSizerAny = AutoSizer as any;

interface CustomerRowData {
    items: Customer[];
    functions: {
        balances: Record<string, number>;
        selectedIds: string[];
        setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
        formatCurrency: (amount: number) => string;
        navigate: (path: string) => void;
        handleRestore: (id: string) => Promise<void>;
        handleDelete: (id: string) => Promise<void>;
    };
}

interface CustomerRowProps {
    index: number;
    style: React.CSSProperties;
    data: CustomerRowData;
}

const CustomerRow = ({ index, style, data }: CustomerRowProps) => {
    const { items, functions } = data;
    const customer = items[index];
    const { 
        balances,
        selectedIds, 
        setSelectedIds, 
        formatCurrency, 
        navigate, 
        handleRestore, 
        handleDelete 
    } = functions;

    const currentBalance = balances[customer.id] || 0;
    const isExceeded = customer.isCreditLimited && customer.creditLimit && currentBalance > customer.creditLimit;
    const isSelected = selectedIds.includes(customer.id);

    const toggleSelection = () => {
        if (isSelected) {
            setSelectedIds((prev: string[]) => prev.filter(id => id !== customer.id));
        } else {
            setSelectedIds((prev: string[]) => [...prev, customer.id]);
        }
    };

    return (
        <div style={style} className={`flex items-center border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-sm ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'} ${isSelected ? 'bg-primary-50 dark:bg-primary-900/10' : ''}`}>
             <div className="w-[5%] px-4 text-center">
                 <input type="checkbox" checked={isSelected} onChange={toggleSelection} className="h-4 w-4 text-primary-600 rounded cursor-pointer"/>
            </div>
            <div className="w-[25%] px-4">
                <div className="flex items-center">
                    <div className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tighter truncate" title={customer.businessName || customer.name}>{customer.businessName || customer.name}</div>
                    {customer.isArchived && (
                        <span className="ml-2 px-2 py-1 text-[10px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full font-bold uppercase">
                            Archivé
                        </span>
                    )}
                </div>
                {customer.businessName && <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">{customer.name}</div>}
            </div>
            <div className="w-[15%] px-4 text-xs font-bold text-gray-500 dark:text-gray-400">
                {formatCurrency(customer.openingBalance || 0)}
            </div>
            <div className="w-[20%] px-4 text-sm">
                 {customer.isCreditLimited ? (
                    <div className="flex flex-col"><span className="text-[9px] font-black text-gray-400 uppercase">Plafond</span><span className="font-black text-gray-700 dark:text-gray-300">{formatCurrency(customer.creditLimit || 0)}</span></div>
                ) : (
                    <span className="text-[9px] text-gray-300 uppercase font-black italic">Sans Limite</span>
                )}
            </div>
            <div className="w-[15%] px-4 text-right">
                <div className={`inline-flex flex-col items-end px-3 py-1 rounded-xl ${isExceeded ? 'bg-red-600 text-white' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
                    <span className={`text-sm font-black ${isExceeded ? 'text-white' : 'text-orange-600'}`}>{formatCurrency(currentBalance)}</span>
                    {isExceeded && <span className="text-[8px] font-black text-white uppercase tracking-tighter">LIMITE DÉPASSÉE</span>}
                </div>
            </div>
            <div className="w-[20%] px-4 text-right flex justify-end">
                <DropdownMenu>
                    <DropdownMenuItem onClick={() => navigate(`/customers/account/${customer.id}`)}><EyeIcon className="w-4 h-4 mr-3 text-blue-500"/> Relevé Compte</DropdownMenuItem>
                    {!customer.isArchived && (
                        <DropdownMenuItem onClick={() => navigate(`/customers/edit/${customer.id}`)}><EditIcon className="w-4 h-4 mr-3"/> Modifier Profil</DropdownMenuItem>
                    )}
                    {customer.isArchived ? (
                        <DropdownMenuItem onClick={() => handleRestore(customer.id)} className="text-green-600 font-bold"><EditIcon className="w-4 h-4 mr-3"/> Restaurer</DropdownMenuItem>
                    ) : (
                        <DropdownMenuItem onClick={() => handleDelete(customer.id)} className="text-red-600 font-bold"><DeleteIcon className="w-4 h-4 mr-3"/> Supprimer</DropdownMenuItem>
                    )}
                </DropdownMenu>
            </div>
        </div>
    );
};

const CustomersPage: React.FC = () => {
    const { hasPermission, user } = useAuth();
    const { customers: cachedCustomers, customersLoading, settings, refreshData } = useData();
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [balances, setBalances] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);

    // Filters
    const [filterType, setFilterType] = useState<'all' | 'debt' | 'exceeded' | 'archived'>('all');
    const [showAll, setShowAll] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCity, setSelectedCity] = useState('all');

    // Printing
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({ contentRef: printRef });

    const fetchData = async () => {
        if (customers.length === 0) setLoading(true);
        
        try {
            const { data: salesData, error: salesError } = await supabase.from('sales').select('*');
            if (salesError) throw salesError;
            
            const { data: paymentsData, error: paymentsError } = await supabase.from('sale_payments').select('*');
            if (paymentsError) throw paymentsError;

            const balanceMap: Record<string, number> = {};
            const currentCustomers = cachedCustomers.length > 0 ? cachedCustomers : customers;
            
            currentCustomers.forEach(c => {
                balanceMap[c.id] = c.openingBalance || 0;
            });

            paymentsData.forEach(p => {
                const saleId = p.saleId as string;
                if (saleId && saleId.startsWith('OPENING_BALANCE_')) {
                    const customerId = saleId.replace('OPENING_BALANCE_', '');
                    if (balanceMap[customerId] !== undefined) {
                        balanceMap[customerId] -= (p.amount || 0);
                    }
                }
            });

            salesData.forEach(sale => {
                const unpaid = sale.grandTotal - (sale.paidAmount || 0);
                if (sale.customerId) {
                     balanceMap[sale.customerId] = (balanceMap[sale.customerId] || 0) + unpaid;
                }
            });

            Object.keys(balanceMap).forEach(key => {
                if (balanceMap[key] < 0) balanceMap[key] = 0;
            });

            setBalances(balanceMap);
        } catch (err) {
            console.error(err);
            setError("Impossible de charger les soldes.");
        } finally {
            setLoading(false);
        }
    };
    
    const handleRestore = async (id: string) => {
        if (confirm("Restaurer ce client ? Il sera à nouveau actif.")) {
            try {
                const { error: updateError } = await supabase.from('customers').update({ 
                    isArchived: false, 
                    archivedAt: null,
                    archivedBy: null
                }).eq('id', id);
                
                if (updateError) throw updateError;
                
                alert("Le client a été restauré avec succès.");
                await fetchData();
                await refreshData(['customers']);
            } catch (err: any) {
                console.error("Erreur lors de la restauration du client:", err);
                setError(`Erreur: ${err.message || 'Une erreur inattendue s\'est produite'}`);
            }
        }
    };
    
    // Update customers from cache
    useEffect(() => {
        if (cachedCustomers.length > 0) {
            setCustomers(cachedCustomers);
            // If we have customers, we can calculate balances immediately if fetchData finished, 
            // or re-run balance calc?
            // Actually fetchData depends on customers for init balances.
            // So we should trigger fetchData when cachedCustomers changes?
            // Or just separate balance calc.
        }
    }, [cachedCustomers]);

    // Trigger balance fetch
    useEffect(() => { fetchData(); }, [cachedCustomers]); // Re-run when customers load to init balances properly

    const cities = useMemo(() => {
        const uniqueCities = new Set(customers.map(c => c.city).filter(Boolean));
        // Cast to string array to avoid TS issues if city is optional
        return Array.from(uniqueCities as Set<string>).sort();
    }, [customers]);

    const filteredCustomers = useMemo(() => {
        return customers.filter(c => {
            // Exclure les clients archivés par défaut
            if (filterType !== 'archived' && c.isArchived) return false;
            if (filterType === 'archived' && !c.isArchived) return false;
            
            const balance = balances[c.id] || 0;
            const term = searchTerm.toLowerCase();
            const matchesSearch = c.name.toLowerCase().includes(term) || (c.businessName && c.businessName.toLowerCase().includes(term));
            const matchesCity = selectedCity === 'all' || c.city === selectedCity;

            if (!matchesCity) return false;

            if (filterType === 'debt') return matchesSearch && balance > 0.01;
            if (filterType === 'exceeded') return matchesSearch && c.isCreditLimited && c.creditLimit && balance > c.creditLimit;
            return matchesSearch;
        });
    }, [customers, balances, filterType, searchTerm, selectedCity]);

    const paginatedCustomers = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredCustomers.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredCustomers, currentPage, itemsPerPage]);



    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

    const handleDelete = async (id: string) => {
        if (window.confirm("Supprimer ce client ? Cette action est irréversible.")) {
            try { 
                const { data: salesData } = await supabase.from('sales').select('id').eq('customerId', id);
                const { data: paymentsData } = await supabase.from('sale_payments').select('id').eq('customerId', id);
                const { data: creditNotesData } = await supabase.from('credit_notes').select('id').eq('customerId', id);
                
                const hasSales = (salesData?.length || 0) > 0;
                const hasPayments = (paymentsData?.length || 0) > 0;
                const hasCreditNotes = (creditNotesData?.length || 0) > 0;
                
                if (hasSales || hasPayments || hasCreditNotes) {
                    const totalRecords = (salesData?.length || 0) + (paymentsData?.length || 0) + (creditNotesData?.length || 0);
                    const message = `Ce client ne peut pas être supprimé car il a ${totalRecords} enregistrement(s) lié(s) :\n\n` +
                        `${hasSales ? `- ${salesData?.length} vente(s)\n` : ''}` +
                        `${hasPayments ? `- ${paymentsData?.length} paiement(s)\n` : ''}` +
                        `${hasCreditNotes ? `- ${creditNotesData?.length} note(s) de crédit\n` : ''}\n` +
                        `Que souhaitez-vous faire ?\n\n` +
                        `OK = Archiver le client (désactivé mais conservé)\n` +
                        `Annuler = Ne rien faire`;
                    
                    if (confirm(message)) {
                        await supabase.from('customers').update({ 
                            isArchived: true, 
                            archivedAt: new Date().toISOString(),
                            archivedBy: user?.uid || 'unknown'
                        }).eq('id', id);
                        
                        alert("Le client a été archivé avec succès.");
                    } else {
                        return;
                    }
                } else {
                    const { error: delError } = await supabase.from('customers').delete().eq('id', id);
                    if (delError) throw delError;
                    alert("Le client a été supprimé avec succès.");
                }
                
                await fetchData(); 
                await refreshData(['customers']);
            } 
            catch (err: any) {
                console.error("Erreur lors de la suppression/archivage du client:", err);
                setError(`Erreur: ${err.message || 'Une erreur inattendue s\'est produite'}`);
            }
        }
    };
    
    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        
        if (window.confirm(`Supprimer ${selectedIds.length} clients ? Cette action est irréversible.`)) {
            try {
                const { data: salesData } = await supabase.from('sales').select('customerId').in('customerId', selectedIds);
                const { data: paymentsData } = await supabase.from('sale_payments').select('customerId').in('customerId', selectedIds);
                const { data: creditNotesData } = await supabase.from('credit_notes').select('customerId').in('customerId', selectedIds);

                const customersWithDependencies = new Set<string>();
                salesData?.forEach(d => customersWithDependencies.add(d.customerId));
                paymentsData?.forEach(d => customersWithDependencies.add(d.customerId));
                creditNotesData?.forEach(d => customersWithDependencies.add(d.customerId));

                if (customersWithDependencies.size > 0) {
                    const count = customersWithDependencies.size;
                    const message = `${count} client(s) ont des enregistrements liés (ventes, paiements ou notes de crédit).\n\n` +
                        `Souhaitez-vous les archiver au lieu de les supprimer ?\n\n` +
                        `OK = Archiver les clients (désactivés mais conservés)\n` +
                        `Annuler = Ne rien faire`;
                    
                    if (confirm(message)) {
                        const { error: updError } = await supabase.from('customers').update({
                            isArchived: true, 
                            archivedAt: new Date().toISOString(),
                            archivedBy: user?.uid || 'unknown'
                        }).in('id', selectedIds);
                        
                        if (updError) throw updError;
                        alert("Les clients ont été archivés avec succès.");
                    } else {
                        return;
                    }
                } else {
                    const { error: delError } = await supabase.from('customers').delete().in('id', selectedIds);
                    if (delError) throw delError;
                    alert("Les clients ont été supprimés avec succès.");
                }

                await fetchData();
                await refreshData(['customers']);
                setSelectedIds([]);
                setIsBulkDeleteModalOpen(false);
            } catch (err: any) {
                console.error("Erreur lors de la suppression/archivage groupé:", err);
                setError(`Erreur lors de la suppression groupée: ${err.message || 'Une erreur inattendue s\'est produite'}`);
            }
        }
    };

    const itemData = useMemo(() => ({
        items: filteredCustomers,
        functions: {
            balances,
            selectedIds,
            setSelectedIds,
            formatCurrency,
            navigate,
            handleRestore,
            handleDelete
        }
    }), [filteredCustomers, balances, selectedIds, formatCurrency, navigate]);

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

            {error && (
                <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-800 flex flex-col gap-2">
                    <div className="flex items-center font-bold">
                        <WarningIcon className="w-5 h-5 mr-2" />
                        {error}
                    </div>
                </div>
            )}

            <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative">
                        <input type="text" placeholder="Nom, entreprise..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl border-none focus:ring-2 focus:ring-primary-500 font-medium" />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIcon className="w-4 h-4"/></div>
                    </div>
                    <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 font-bold">
                        <option value="all">Toutes les villes</option>
                        {cities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 font-bold">
                        <option value="all">Tous les clients</option>
                        <option value="debt">Clients Endettés</option>
                        <option value="exceeded">Plafond Dépassé</option>
                        <option value="archived">Clients Archivés</option>
                    </select>
                    <button 
                        onClick={() => { setShowAll(!showAll); if (!showAll) setCurrentPage(1); }} 
                        className={`px-4 py-2 rounded-xl font-bold uppercase text-xs shadow-lg transition-all hover:scale-105 ${showAll ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600'}`}
                    >
                        {showAll ? 'Vue Paginée' : 'Tout afficher'}
                    </button>
                    <button onClick={() => setIsPrintModalOpen(true)} className="px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-black font-bold uppercase text-xs shadow-lg flex items-center justify-center transition-all hover:scale-105">
                        <PrintIcon className="w-4 h-4 mr-2" /> Imprimer
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="p-24 text-center text-gray-400 font-black uppercase tracking-widest animate-pulse">Chargement de la base clients...</div>
            ) : (
            showAll ? (
                <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl border border-gray-100 dark:border-gray-700 h-[75vh] flex flex-col">
                    <div className="flex items-center bg-primary-600 text-white px-0 py-4 font-black uppercase text-[10px] tracking-wider sticky top-0 z-10">
                        <div className="w-[5%] px-4 text-center">
                            <input type="checkbox" checked={filteredCustomers.length > 0 && selectedIds.length === filteredCustomers.length} onChange={(e) => setSelectedIds(e.target.checked ? filteredCustomers.map(c => c.id) : [])} className="h-4 w-4 rounded cursor-pointer"/>
                        </div>
                        <div className="w-[25%] px-4 text-left">Identité / Entreprise</div>
                        <div className="w-[15%] px-4 text-left">Ouverture</div>
                        <div className="w-[20%] px-4 text-left">Limite Crédit</div>
                        <div className="w-[15%] px-4 text-right">Solde Actuel</div>
                        <div className="w-[20%] px-4 text-right">Actions</div>
                    </div>
                    <div className="flex-1">
                        <AutoSizerAny>
                            {({ height, width }: { height: number; width: number }) => (
                                <List
                                    height={height}
                                    width={width}
                                    itemCount={filteredCustomers.length}
                                    itemSize={80}
                                    itemData={itemData}
                                >
                                    {CustomerRow}
                                </List>
                            )}
                        </AutoSizerAny>
                    </div>
                     <div className="bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-700 p-4 flex justify-end space-x-8">
                        <div className="text-right text-xs font-black uppercase text-primary-600">Total Global Crédits (Créances): <span className="ml-2 text-orange-600 text-sm">{formatCurrency(filteredCustomers.reduce((sum, c) => sum + (balances[c.id] || 0), 0))}</span></div>
                        <div className="text-right text-xs font-black uppercase text-gray-900 dark:text-white">Clients: <span className="ml-2">{filteredCustomers.length}</span></div>
                    </div>
                </div>
            ) : (
            <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-primary-600 text-white">
                            <tr>
                                <th className="px-4 py-4 w-10 text-center"><input type="checkbox" onChange={e => setSelectedIds(e.target.checked ? paginatedCustomers.map(c => c.id) : [])} className="h-4 w-4 text-primary-900 border-white rounded"/></th>
                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest">Identité / Entreprise</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest">Ouverture</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest">Limite Crédit</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest">Solde Actuel</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {paginatedCustomers.map(item => {
                                const currentBalance = balances[item.id] || 0;
                                const isExceeded = item.isCreditLimited && item.creditLimit && currentBalance > item.creditLimit;
                                return (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-4 py-4 text-center">
                                            <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds(prev => prev.includes(item.id) ? prev.filter(p => p !== item.id) : [...prev, item.id])} className="h-4 w-4 text-primary-600 rounded"/>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tighter">{item.businessName || item.name}</div>
                                                {item.isArchived && (
                                                    <span className="ml-2 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full font-bold uppercase">
                                                        Archivé
                                                    </span>
                                                )}
                                            </div>
                                            {item.businessName && <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.name}</div>}
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
                                                {!item.isArchived && (
                                                    <DropdownMenuItem onClick={() => navigate(`/customers/edit/${item.id}`)}><EditIcon className="w-4 h-4 mr-3"/> Modifier Profil</DropdownMenuItem>
                                                )}
                                                {item.isArchived ? (
                                                    <DropdownMenuItem onClick={() => handleRestore(item.id)} className="text-green-600 font-bold"><EditIcon className="w-4 h-4 mr-3"/> Restaurer</DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-red-600 font-bold"><DeleteIcon className="w-4 h-4 mr-3"/> Supprimer</DropdownMenuItem>
                                                )}
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="border-t-2 border-gray-200 dark:border-gray-700">
                            <tr className="bg-blue-100 dark:bg-blue-900/40">
                                <td colSpan={4} className="px-6 py-4 text-right text-xs font-black uppercase text-primary-600 tracking-widest">Total Global Crédits (Créances)</td>
                                <td className="px-6 py-4 text-right text-sm font-black text-orange-600">
                                    {formatCurrency(filteredCustomers.reduce((sum, c) => sum + (balances[c.id] || 0), 0))}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                {filteredCustomers.length > itemsPerPage && (
                    <Pagination 
                        currentPage={currentPage} 
                        totalPages={totalPages} 
                        onPageChange={setCurrentPage} 
                        totalItems={filteredCustomers.length} 
                        itemsPerPage={itemsPerPage} 
                    />
                )}
            </div>
            )
            )}

            <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} title="CONFIRMATION SUPPRESSION">
                <div className="p-6">
                    <p className="text-gray-600 dark:text-gray-300 mb-6 font-medium">Voulez-vous vraiment supprimer les {selectedIds.length} clients sélectionnés ? Cette action est irréversible.</p>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setIsBulkDeleteModalOpen(false)} className="px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-gray-500">ANNULER</button>
                        <button onClick={handleBulkDelete} className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold shadow-lg">CONFIRMER SUPPRESSION</button>
                    </div>
                </div>
            </Modal>

             <Modal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} title="IMPRIMER LISTE CLIENTS" maxWidth="max-w-4xl">
                <div className="flex flex-col items-center p-6">
                    <div className="w-full overflow-auto bg-gray-100 dark:bg-gray-700 p-4 rounded-xl mb-6 shadow-inner max-h-[70vh]">
                        <div className="transform scale-90 origin-top">
                             <CustomerListPrint 
                                ref={printRef}
                                customers={filteredCustomers}
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

export default CustomersPage;
