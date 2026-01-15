
import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { collection, doc, query, orderBy, where, runTransaction, onSnapshot, DocumentReference } from 'firebase/firestore';
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
    const ITEMS_PER_PAGE = 10;
    
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

    useEffect(() => {
        // Chargement réactif uniquement des ventes
        const q = query(collection(db, "sales"), orderBy("date", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
            setLoading(false);
        }, (err) => {
            setError("Erreur de synchronisation des ventes.");
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => { setCurrentPage(1); }, [filters]);

    const userVisibleWarehouses = useMemo(() => {
        if (!user) return [];
        if (user.role.name.toLowerCase().includes('admin')) return warehouses;
        return warehouses.filter(wh => user.warehouseIds?.includes(wh.id));
    }, [user, warehouses]);

    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            const userWarehouseIds = userVisibleWarehouses.map(wh => wh.id);
            if (!userWarehouseIds.includes(sale.warehouseId)) return false;

            const searchTermMatch = filters.searchTerm === '' || sale.referenceNumber.toLowerCase().includes(filters.searchTerm.toLowerCase());
            const customerMatch = filters.customerId === 'all' || sale.customerId === filters.customerId;
            const warehouseMatch = filters.warehouseId === 'all' || sale.warehouseId === filters.warehouseId;
            const paymentStatusMatch = filters.paymentStatus === 'all' || sale.paymentStatus === filters.paymentStatus;
            
            let dateMatch = true;
            if (filters.startDate) dateMatch = dateMatch && new Date(sale.date) >= new Date(filters.startDate);
            if (filters.endDate) dateMatch = dateMatch && new Date(sale.date) <= new Date(filters.endDate);

            return searchTermMatch && customerMatch && warehouseMatch && paymentStatusMatch && dateMatch;
        });
    }, [sales, filters, userVisibleWarehouses]);

    const paginatedSales = useMemo(() => filteredSales.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [filteredSales, currentPage]);
    const totalPages = Math.ceil(filteredSales.length / ITEMS_PER_PAGE);

    const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || 'Inconnu';
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

    const formatCurrency = (v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' FCFA';
    const getPaymentBadge = (s: Sale['paymentStatus']) => ({'Payé': 'bg-green-100 text-green-800','Partiel': 'bg-blue-100 text-blue-800','En attente': 'bg-yellow-100 text-yellow-800'}[s] || '');

    return (
        <div className="pb-10">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Journal des Ventes</h1>
                    <p className="text-gray-500 text-sm">Gestion des factures et encaissements.</p>
                </div>
                <button onClick={() => navigate('/sales/new')} className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-black uppercase text-xs shadow-xl"><PlusIcon className="w-5 h-5 mr-2" />Nouvelle Vente</button>
            </div>

            <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-xl border dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input type="text" placeholder="Réf. Vente..." name="searchTerm" value={filters.searchTerm} onChange={handleFilterChange} className="px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 outline-none focus:ring-2 focus:ring-primary-500"/>
                    <select name="customerId" value={filters.customerId} onChange={handleFilterChange} className="px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 font-bold">
                        <option value="all">Tous les clients</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
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
                                        <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tighter">{sale.referenceNumber}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 font-medium uppercase truncate max-w-[150px]">{getCustomerName(sale.customerId)}</td>
                                        <td className="px-6 py-4 text-xs font-bold">{new Date(sale.date).toLocaleDateString('fr-FR')}</td>
                                        <td className="px-6 py-4 text-sm font-black">{formatCurrency(sale.grandTotal)}</td>
                                        <td className="px-6 py-4 text-sm font-black text-red-600">{formatCurrency(sale.grandTotal - sale.paidAmount)}</td>
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
                        </table>
                    </div>
                </div>
            )}
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filteredSales.length} itemsPerPage={ITEMS_PER_PAGE} />
        </div>
    );
};

export default SalesPage;
