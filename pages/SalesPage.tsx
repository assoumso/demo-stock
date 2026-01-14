
import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { collection, getDocs, deleteDoc, doc, writeBatch, query, orderBy, where, runTransaction, DocumentData, DocumentReference } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Sale, Customer, SalePayment, PaymentMethod, PaymentStatus, Warehouse, Product } from '../types';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { PlusIcon, EditIcon, DeleteIcon, DocumentTextIcon, PaymentIcon, WarningIcon } from '../constants';
import DropdownMenu, { DropdownMenuItem } from '../components/DropdownMenu';

const SalesPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [sales, setSales] = useState<Sale[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
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
    const [newPayment, setNewPayment] = useState({ 
        amount: 0, 
        method: 'Espèces' as PaymentMethod, 
        date: new Date().toISOString().split('T')[0],
        attachmentFile: null as File | null
    });
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);


    const fetchData = async () => {
        if (!loading) setLoading(true);
        setError(null);
        try {
            const salesQuery = query(collection(db, "sales"), orderBy("date", "desc"));
            const [salesSnapshot, customersSnapshot, warehousesSnapshot, productsSnapshot] = await Promise.all([
                getDocs(salesQuery),
                getDocs(collection(db, "customers")),
                getDocs(collection(db, "warehouses")),
                getDocs(collection(db, "products")),
            ]);
            setSales(salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
            setCustomers(customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
            setWarehouses(warehousesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
            setProducts(productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        } catch (err) {
            console.error("Error fetching sales data:", err);
            setError("Impossible de charger les données des ventes.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);
    useEffect(() => { setCurrentPage(1); }, [filters]);
    useEffect(() => { setSelectedIds([]); }, [currentPage]);

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

    const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || 'N/A';
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };
    const handleSelectOne = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]);
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => setSelectedIds(e.target.checked ? paginatedSales.map(s => s.id) : []);

    const handleDelete = async (sale: Sale) => {
        const hasProduct = sale.items.some(item => products.find(p => p.id === item.productId)?.type === 'product');
        let confirmMessage = `Supprimer la vente ${sale.referenceNumber} ?`;
        if (hasProduct && sale.saleStatus === 'Complétée') confirmMessage += " Le stock sera restitué.";
        if (isProcessing || !window.confirm(confirmMessage)) return;
        setIsProcessing(sale.id);
        try {
            await runTransaction(db, async (transaction) => {
                const saleRef = doc(db, "sales", sale.id);
                const saleDoc = await transaction.get(saleRef);
                if (!saleDoc.exists()) throw new Error("Vente déjà supprimée.");
                const currentSaleData = saleDoc.data() as Sale;
                const productUpdateData: { ref: DocumentReference, newStockLevels: any[] }[] = [];
                if (currentSaleData.saleStatus === 'Complétée' && currentSaleData.items?.length > 0) {
                    for (const item of currentSaleData.items) {
                        const productRef = doc(db, "products", item.productId);
                        const pDoc = await transaction.get(productRef);
                        if (pDoc.exists() && pDoc.data().type !== 'service') {
                            const stockLevels = [...(pDoc.data().stockLevels || [])];
                            const idx = stockLevels.findIndex(sl => sl.warehouseId === currentSaleData.warehouseId);
                            if (idx !== -1) {
                                stockLevels[idx].quantity += item.quantity;
                                productUpdateData.push({ ref: productRef, newStockLevels: stockLevels });
                            }
                        }
                    }
                }
                for (const update of productUpdateData) transaction.update(update.ref, { stockLevels: update.newStockLevels });
                transaction.delete(saleRef);
            });
            await fetchData();
        } catch (err: any) { setError(`Erreur: ${err.message}`); } finally { setIsProcessing(null); }
    };
    
    const handleBulkDelete = async () => {
        if (!window.confirm(`Supprimer les ${selectedIds.length} ventes sélectionnées ?`)) return;
        setIsBulkDeleteModalOpen(false);
        setIsProcessing('bulk-delete');
        for (const id of selectedIds) {
            const sale = sales.find(s => s.id === id);
            if (sale) { await handleDelete(sale); await new Promise(r => setTimeout(r, 500)); }
        }
        await fetchData();
        setSelectedIds([]);
        setIsProcessing(null);
    };

    const getDeadlineBadge = (sale: Sale) => {
        if (!sale.paymentDueDate || sale.paymentStatus === 'Payé') return null;
        const now = new Date();
        const dueDate = new Date(sale.paymentDueDate);
        const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
        
        if (diffDays < 0) return <span className="flex items-center text-[10px] font-black text-red-600 uppercase"><WarningIcon className="w-3 h-3 mr-1"/> Retard</span>;
        return <span className="text-[10px] text-gray-500 uppercase font-black">J-{diffDays}</span>;
    };

    const handleOpenPaymentModal = async (sale: Sale) => {
        setSelectedSale(sale);
        setError(null);
        try {
            const q = query(collection(db, "salePayments"), where("saleId", "==", sale.id));
            const snap = await getDocs(q);
            const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalePayment));
            fetched.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setPayments(fetched);
        } catch (err) { setPayments([]); setError("Erreur chargement paiements."); }
        const balance = sale.grandTotal - sale.paidAmount;
        setNewPayment({ amount: balance > 0 ? balance : 0, method: 'Espèces', date: new Date().toISOString().split('T')[0], attachmentFile: null });
        setIsPaymentModalOpen(true);
    };

    const handleAddPayment = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedSale || newPayment.amount <= 0 || !user) return setError("Montant invalide.");
        const balance = selectedSale.grandTotal - selectedSale.paidAmount;
        if (newPayment.amount > balance + 0.01) return setError("Montant supérieur au solde.");
        setIsSubmittingPayment(true);
        try {
            let attachmentUrl: string | undefined;
            if (newPayment.attachmentFile) {
                const sRef = ref(storage, `sale_payment_attachments/${selectedSale.id}/${Date.now()}_${newPayment.attachmentFile.name}`);
                await uploadBytes(sRef, newPayment.attachmentFile);
                attachmentUrl = await getDownloadURL(sRef);
            }
            await runTransaction(db, async (transaction) => {
                const sRef = doc(db, 'sales', selectedSale.id);
                const sDoc = await transaction.get(sRef);
                const current = sDoc.data() as Sale;
                const newPaid = current.paidAmount + newPayment.amount;
                let status: PaymentStatus = newPaid >= current.grandTotal - 0.01 ? 'Payé' : 'Partiel';
                transaction.update(sRef, { paidAmount: newPaid, paymentStatus: status });
                transaction.set(doc(collection(db, "salePayments")), { saleId: selectedSale.id, date: new Date(newPayment.date).toISOString(), amount: newPayment.amount, method: newPayment.method, createdByUserId: user.uid, ...(attachmentUrl && { attachmentUrl }) });
            });
            await fetchData();
            setIsPaymentModalOpen(false);
        } catch (err: any) { setError(`Erreur: ${err.message}`); } finally { setIsSubmittingPayment(false); }
    };

    const formatCurrency = (v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' FCFA';
    const areAllOnPageSelected = paginatedSales.length > 0 && selectedIds.length === paginatedSales.length;
    const getPaymentBadge = (s: Sale['paymentStatus']) => ({'Payé': 'bg-green-100 text-green-800','Partiel': 'bg-blue-100 text-blue-800','En attente': 'bg-yellow-100 text-yellow-800'}[s] || '');
    
    const remainingBalance = selectedSale ? selectedSale.grandTotal - selectedSale.paidAmount : 0;

    return (
        <div className="pb-10">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white uppercase tracking-tight">Liste des Ventes</h1>
                 <div className="flex items-center space-x-2">
                    {selectedIds.length > 0 && <button onClick={() => setIsBulkDeleteModalOpen(true)} disabled={!!isProcessing} className="flex items-center px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 font-bold uppercase text-xs">Supprimer ({selectedIds.length})</button>}
                    <button onClick={() => navigate('/sales/new')} disabled={!!isProcessing} className="flex items-center px-4 py-2 text-sm text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 font-bold uppercase text-xs"><PlusIcon className="w-5 h-5 mr-2" />Nouvelle Vente</button>
                </div>
            </div>

            <div className="mb-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input type="text" placeholder="Réf. Vente..." name="searchTerm" value={filters.searchTerm} onChange={handleFilterChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 outline-none focus:ring-2 focus:ring-primary-500 transition-all"/>
                    <select name="customerId" value={filters.customerId} onChange={handleFilterChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"><option value="all">Tous les clients</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <select name="warehouseId" value={filters.warehouseId} onChange={handleFilterChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"><option value="all">Tous les entrepôts</option>{userVisibleWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
                    <select name="paymentStatus" value={filters.paymentStatus} onChange={handleFilterChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"><option value="all">Statut Paiement</option><option value="Payé">Payé</option><option value="Partiel">Partiel</option><option value="En attente">En attente</option></select>
                </div>
            </div>

            {loading ? <p className="text-center py-10 text-gray-500 font-bold animate-pulse">Chargement des ventes...</p> : (
            <>
            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl border dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-primary-600"><tr>
                            <th className="px-4 py-3 w-10 text-center"><input type="checkbox" className="h-4 w-4 text-primary-900 border-white rounded" checked={areAllOnPageSelected} onChange={handleSelectAll}/></th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">Référence</th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">Client</th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">Date / Échéance</th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">Total</th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-white uppercase tracking-widest">Paiement</th>
                            <th className="px-6 py-3 text-right text-[10px] font-black text-white uppercase tracking-widest">Actions</th>
                        </tr></thead>
                        <tbody className="bg-white divide-y divide-gray-100 dark:bg-gray-800 dark:divide-gray-700">
                            {paginatedSales.map(sale => (
                                <tr key={sale.id} className={`${selectedIds.includes(sale.id) ? 'bg-primary-50 dark:bg-primary-900/10' : ''} transition-colors`}>
                                    <td className="px-4 py-4 text-center"><input type="checkbox" className="h-4 w-4 text-primary-600 rounded" checked={selectedIds.includes(sale.id)} onChange={() => handleSelectOne(sale.id)}/></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tighter">{sale.referenceNumber}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 font-medium uppercase tracking-tighter truncate max-w-[150px]">{getCustomerName(sale.customerId)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-xs font-bold">{new Date(sale.date).toLocaleDateString('fr-FR')}</div>
                                        <div className="mt-1">{getDeadlineBadge(sale)}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-black">{formatCurrency(sale.grandTotal)}</div>
                                        <div className="text-[9px] font-bold text-red-500 uppercase">Dû: {formatCurrency(sale.grandTotal - sale.paidAmount)}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm"><span className={`px-3 py-1 inline-flex text-[9px] font-black leading-5 rounded-full uppercase tracking-widest ${getPaymentBadge(sale.paymentStatus)}`}>{sale.paymentStatus}</span></td>
                                    <td className="px-6 py-4 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuItem onClick={() => navigate(`/sales/edit/${sale.id}`)}><EditIcon className="w-4 h-4 mr-3" /> Modifier</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleOpenPaymentModal(sale)}><PaymentIcon className="w-4 h-4 mr-3" /> Règlement</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => navigate(`/sales/invoice/${sale.id}`)}><DocumentTextIcon className="w-4 h-4 mr-3" /> Facture PDF</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDelete(sale)} className="text-red-600 font-bold"><DeleteIcon className="w-4 h-4 mr-3" /> Supprimer</DropdownMenuItem>
                                        </DropdownMenu>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filteredSales.length} itemsPerPage={ITEMS_PER_PAGE} />
            </>
            )}
        </div>
    );
};

export default SalesPage;
