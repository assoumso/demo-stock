
import React, { useState, useEffect, useMemo, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { collection, doc, query, orderBy, where, runTransaction, onSnapshot, limit, DocumentReference } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Sale, SalePayment, PaymentMethod, PaymentStatus } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../context/DataContext'; // Hook de cache
import Modal from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { PlusIcon, EditIcon, DeleteIcon, DocumentTextIcon, PaymentIcon, WarningIcon, DownloadIcon } from '../constants';
import DropdownMenu, { DropdownMenuItem } from '../components/DropdownMenu';

const SalesPage: React.FC = () => {
    const { user } = useAuth();
    const { customers, warehouses } = useData(); // Utilisation du cache global
    const navigate = useNavigate();

    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [showAll, setShowAll] = useState(false);
    
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        warehouseId: 'all',
        customerId: 'all',
        paymentStatus: 'all',
        searchTerm: ''
    });

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [payments, setPayments] = useState<SalePayment[]>([]);
    const [newPayment, setNewPayment] = useState({ amount: 0, method: 'Espèces' as PaymentMethod, momoOperator: '', momoNumber: '', date: new Date().toISOString().split('T')[0], attachmentFile: null as File | null });
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const [limitCount, setLimitCount] = useState(50);

    // Autocomplete State
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
    const customerWrapperRef = useRef<HTMLDivElement>(null);

    // Close suggestions on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (customerWrapperRef.current && !customerWrapperRef.current.contains(event.target as Node)) {
                setShowCustomerSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Sync customerSearch with selected filter
    useEffect(() => {
        if (filters.customerId === 'all') {
            setCustomerSearch('');
        } else {
            const c = customers.find(c => c.id === filters.customerId);
            if (c && c.name !== customerSearch) setCustomerSearch(c.name);
        }
    }, [filters.customerId, customers]);

    const filteredCustomers = useMemo(() => {
        if (!customerSearch) return customers.slice(0, 10);
        return customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()));
    }, [customers, customerSearch]);

    useEffect(() => {
        // Chargement réactif uniquement des ventes
        const q = query(collection(db, "sales"), orderBy("date", "desc"), limit(limitCount));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
            setLoading(false);
        }, (err) => {
            setError("Erreur de synchronisation des ventes.");
            setLoading(false);
        });
        return () => unsubscribe();
    }, [limitCount]);

    useEffect(() => { setCurrentPage(1); }, [filters]);

    const userVisibleWarehouses = useMemo(() => {
        try {
            if (!user || !user.role) return [];
            // Safe access to role name
            const roleName = String(user.role.name || '').toLowerCase();
            if (roleName.includes('admin')) return warehouses;
            
            // Safe access to warehouseIds
            const userWhIds = user.warehouseIds || [];
            return warehouses.filter(wh => userWhIds.includes(wh.id));
        } catch (err) {
            console.error("Error in userVisibleWarehouses:", err);
            return [];
        }
    }, [user, warehouses]);

    const filteredSales = useMemo(() => {
        if (!sales) return [];
        return sales.filter(sale => {
            try {
                if (!sale) return false;
                
                const userWarehouseIds = userVisibleWarehouses.map(wh => wh.id);
                // Handle case where sale has no warehouseId (legacy data?)
                if (sale.warehouseId && !userWarehouseIds.includes(sale.warehouseId)) return false;

                const refNum = sale.referenceNumber ? String(sale.referenceNumber).toLowerCase() : '';
                const searchTermMatch = filters.searchTerm === '' || refNum.includes(filters.searchTerm.toLowerCase());
                
                const customerMatch = filters.customerId === 'all' || sale.customerId === filters.customerId;
                const warehouseMatch = filters.warehouseId === 'all' || sale.warehouseId === filters.warehouseId;
                const paymentStatusMatch = filters.paymentStatus === 'all' || sale.paymentStatus === filters.paymentStatus;
                
                let dateMatch = true;
                // Handle date safely
                if (sale.date) {
                    const saleDate = new Date(sale.date);
                    if (filters.startDate) dateMatch = dateMatch && saleDate >= new Date(filters.startDate);
                    if (filters.endDate) dateMatch = dateMatch && saleDate <= new Date(filters.endDate);
                } else if (filters.startDate || filters.endDate) {
                    dateMatch = false; // If date missing but filter active, exclude
                }

                return searchTermMatch && customerMatch && warehouseMatch && paymentStatusMatch && dateMatch;
            } catch (err) {
                console.error("Error filtering sale:", sale, err);
                return false;
            }
        });
    }, [sales, filters, userVisibleWarehouses]);

    const paginatedSales = useMemo(() => {
        if (showAll) return filteredSales;
        return filteredSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    }, [filteredSales, currentPage, itemsPerPage, showAll]);
    
    const totalPages = Math.ceil(filteredSales.length / itemsPerPage);

    const formatDate = (date: any) => {
        if (!date) return '-';
        try {
            if (typeof date.toDate === 'function') return date.toDate().toLocaleDateString('fr-FR');
            const d = new Date(date);
            return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('fr-FR');
        } catch (e) { return '-'; }
    };

    const formatCurrency = (v: any) => {
        try {
            const val = Number(v) || 0;
            return new Intl.NumberFormat('fr-FR').format(val).replace(/\u202f/g, ' ') + ' FCFA';
        } catch (e) { return '0 FCFA'; }
    };

    const getCustomerName = (id: string) => {
        try {
            if (!customers || !Array.isArray(customers)) return 'Inconnu';
            const customer = customers.find(c => c && c.id === id);
            return customer?.name || 'Inconnu';
        } catch (e) { return 'Inconnu'; }
    };
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleDelete = async (sale: Sale) => {
        if (isProcessing || !window.confirm(`Supprimer la vente ${sale.referenceNumber} ?`)) return;
        setIsProcessing(sale.id);
        try {
            await runTransaction(db, async (transaction) => {
                const saleRef = doc(db, "sales", sale.id);
                const sDoc = await transaction.get(saleRef);
                if (!sDoc.exists()) throw new Error("Déjà supprimé.");
                const currentData = sDoc.data() as Sale;
                
                // Restituer le stock si vente complétée
                if (currentData.saleStatus === 'Complétée') {
                    for (const item of currentData.items) {
                        const pRef = doc(db, "products", item.productId);
                        const pSnap = await transaction.get(pRef);
                        if (pSnap.exists()) {
                            const pData = pSnap.data();
                            const stockLevels = [...(pData.stockLevels || [])];
                            const idx = stockLevels.findIndex(sl => sl.warehouseId === currentData.warehouseId);
                            if (idx !== -1) {
                                stockLevels[idx].quantity += item.quantity;
                                transaction.update(pRef, { stockLevels });
                            }
                        }
                    }
                }
                transaction.delete(saleRef);
            });
        } catch (err: any) { setError(err.message); } finally { setIsProcessing(null); }
    };


    const getPaymentBadge = (s: Sale['paymentStatus']) => {
        const badges: Record<string, string> = {
            'Payé': 'bg-green-100 text-green-800',
            'Partiel': 'bg-blue-100 text-blue-800',
            'En attente': 'bg-yellow-100 text-yellow-800'
        };
        return badges[s] || 'bg-gray-100 text-gray-800';
    };

    // Calcul des totaux
    const totalGlobalAmount = useMemo(() => filteredSales.reduce((sum, s) => sum + (Number(s.grandTotal) || 0), 0), [filteredSales]);
    const totalGlobalBalance = useMemo(() => filteredSales.reduce((sum, s) => sum + ((Number(s.grandTotal) || 0) - (Number(s.paidAmount) || 0)), 0), [filteredSales]);
    
    const totalPageAmount = useMemo(() => paginatedSales.reduce((sum, s) => sum + (Number(s.grandTotal) || 0), 0), [paginatedSales]);
    const totalPageBalance = useMemo(() => paginatedSales.reduce((sum, s) => sum + ((Number(s.grandTotal) || 0) - (Number(s.paidAmount) || 0)), 0), [paginatedSales]);

    return (
        <div className="pb-10">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Journal des Ventes</h1>
                    <p className="text-gray-500 text-sm">Gestion des factures et encaissements. <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded ml-2">Affichage des {limitCount} dernières ventes</span></p>
                </div>
                <div className="flex space-x-2">
                    <button onClick={() => setLimitCount(prev => prev + 500)} className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 font-bold uppercase text-xs transition-colors">
                        Charger +
                    </button>
                    <button onClick={() => setShowAll(!showAll)} className="px-4 py-3 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 font-bold uppercase text-xs transition-colors">
                        {showAll ? 'Vue par page' : 'Tout afficher'}
                    </button>
                    <button onClick={() => navigate('/sales/new')} className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-black uppercase text-xs shadow-xl"><PlusIcon className="w-5 h-5 mr-2" />Nouvelle Vente</button>
                </div>
            </div>

            <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-xl border dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input type="text" placeholder="Réf. Vente..." name="searchTerm" value={filters.searchTerm} onChange={handleFilterChange} className="px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 outline-none focus:ring-2 focus:ring-primary-500"/>
                    
                    {/* Customer Autocomplete */}
                    <div className="relative" ref={customerWrapperRef}>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Filtrer par client..."
                                value={customerSearch}
                                onChange={(e) => {
                                    setCustomerSearch(e.target.value);
                                    setShowCustomerSuggestions(true);
                                    if (e.target.value === '') {
                                        setFilters(prev => ({ ...prev, customerId: 'all' }));
                                    }
                                }}
                                onFocus={() => setShowCustomerSuggestions(true)}
                                className="w-full px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 outline-none focus:ring-2 focus:ring-primary-500 font-bold"
                            />
                            {customerSearch && (
                                <button
                                    onClick={() => {
                                        setFilters(prev => ({ ...prev, customerId: 'all' }));
                                        setCustomerSearch('');
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                                >
                                    <DeleteIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        {showCustomerSuggestions && (
                            <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 shadow-xl max-h-60 rounded-xl py-1 border dark:border-gray-700 overflow-auto">
                                <li
                                    onClick={() => {
                                        setFilters(prev => ({ ...prev, customerId: 'all' }));
                                        setCustomerSearch('');
                                        setShowCustomerSuggestions(false);
                                    }}
                                    className="cursor-pointer px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-bold text-gray-500 italic border-b dark:border-gray-700"
                                >
                                    Tous les clients
                                </li>
                                {filteredCustomers.length > 0 ? (
                                    filteredCustomers.map(c => (
                                        <li
                                            key={c.id}
                                            onClick={() => {
                                                setFilters(prev => ({ ...prev, customerId: c.id }));
                                                setCustomerSearch(c.name);
                                                setShowCustomerSuggestions(false);
                                            }}
                                            className="cursor-pointer px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-bold text-gray-800 dark:text-gray-200"
                                        >
                                            {c.name}
                                        </li>
                                    ))
                                ) : (
                                    <li className="px-4 py-2 text-sm text-gray-400 italic">Aucun client trouvé</li>
                                )}
                            </ul>
                        )}
                    </div>

                    <select name="warehouseId" value={filters.warehouseId} onChange={handleFilterChange} className="px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 font-bold">
                        <option value="all">Tous les entrepôts</option>
                        {userVisibleWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <select name="paymentStatus" value={filters.paymentStatus} onChange={handleFilterChange} className="px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 font-bold">
                        <option value="all">Tout statut</option>
                        <option value="Payé">Payé</option>
                        <option value="Partiel">Partiel</option>
                        <option value="En attente">En attente</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="p-24 text-center text-gray-400 font-black uppercase animate-pulse">Lecture du journal...</div>
            ) : (
                <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl border dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-primary-600 text-white">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase">Référence</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase">Client</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase">Date</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase">Total</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase">Solde</th>
                                    <th className="px-6 py-4 text-center text-[10px] font-black uppercase">Paiement</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {paginatedSales.map(sale => (
                                    <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tighter">{sale.referenceNumber || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 font-medium uppercase truncate max-w-[150px]">{getCustomerName(sale.customerId)}</td>
                                    <td className="px-6 py-4 text-xs font-bold">{formatDate(sale.date)}</td>
                                    <td className="px-6 py-4 text-sm font-black">{formatCurrency(sale.grandTotal)}</td>
                                    <td className="px-6 py-4 text-sm font-black text-red-600">{formatCurrency(Number(sale.grandTotal || 0) - Number(sale.paidAmount || 0))}</td>
                                    <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 text-[9px] font-black rounded-full uppercase ${getPaymentBadge(sale.paymentStatus)}`}>
                                                {sale.paymentStatus}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuItem onClick={() => navigate(`/sales/edit/${sale.id}`)}><EditIcon className="w-4 h-4 mr-3" /> Modifier</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => navigate(`/sales/invoice/${sale.id}`)}><DocumentTextIcon className="w-4 h-4 mr-3" /> Facture</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDelete(sale)} className="text-red-600 font-bold"><DeleteIcon className="w-4 h-4 mr-3" /> Supprimer</DropdownMenuItem>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t-2 border-gray-200 dark:border-gray-700">
                                <tr className="bg-blue-50 dark:bg-blue-900/20 border-b dark:border-gray-700">
                                    <td colSpan={3} className="px-6 py-3 text-right text-xs font-black uppercase text-gray-500">Total Page</td>
                                    <td className="px-6 py-3 text-sm font-black text-gray-900 dark:text-white">{formatCurrency(totalPageAmount)}</td>
                                    <td className="px-6 py-3 text-sm font-black text-red-600">{formatCurrency(totalPageBalance)}</td>
                                    <td colSpan={2}></td>
                                </tr>
                                <tr className="bg-blue-100 dark:bg-blue-900/40">
                                    <td colSpan={3} className="px-6 py-3 text-right text-xs font-black uppercase text-primary-600">Total Global</td>
                                    <td className="px-6 py-3 text-sm font-black text-primary-600">{formatCurrency(totalGlobalAmount)}</td>
                                    <td className="px-6 py-3 text-sm font-black text-red-600">{formatCurrency(totalGlobalBalance)}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
            {!showAll && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filteredSales.length} itemsPerPage={itemsPerPage} />}
        </div>
    );
};

export default SalesPage;
