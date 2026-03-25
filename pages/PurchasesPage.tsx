
import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Purchase, Supplier, Payment, PaymentMethod, PaymentStatus, Warehouse, Product } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../context/DataContext';
import Modal from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { PlusIcon, EditIcon, DeleteIcon, DocumentTextIcon, PaymentIcon, DownloadIcon, UploadIcon, PrintIcon } from '../constants';
import DropdownMenu, { DropdownMenuItem } from '../components/DropdownMenu';
import { formatCurrency, formatDate } from '../utils/formatters';
import { PurchaseListPrint } from '../components/PurchaseListPrint';
import { useReactToPrint } from 'react-to-print';
import * as ReactWindow from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { useRef } from 'react';

const List = (ReactWindow as any).FixedSizeList;
const SafeAutoSizer = AutoSizer as any;

// Row component for virtualization
interface PurchaseRowData {
    items: Purchase[];
    functions: {
        selectedIds: string[];
        handleSelectOne: (id: string) => void;
        getSupplierName: (id: string) => string;
        formatCurrency: (amount: number) => string;
        formatDate: (date: string | Date) => string;
        getPurchaseStatusBadge: (status: Purchase['purchaseStatus']) => string;
        getPaymentStatusBadge: (status: Purchase['paymentStatus']) => string;
        navigate: (path: string) => void;
        handleDelete: (purchase: Purchase) => Promise<void>;
        handleOpenPaymentModal: (purchase: Purchase) => Promise<void>;
        isProcessing: string | null;
    };
}

interface PurchaseRowProps {
    index: number;
    style: React.CSSProperties;
    data: PurchaseRowData;
}

const PurchaseRow = ({ index, style, data }: PurchaseRowProps) => {
    const purchase = data.items[index];
    const { 
        selectedIds, 
        handleSelectOne, 
        getSupplierName, 
        formatCurrency, 
        formatDate, 
        getPurchaseStatusBadge, 
        getPaymentStatusBadge, 
        navigate, 
        handleDelete, 
        handleOpenPaymentModal,
        isProcessing
    } = data.functions;

    return (
        <div style={style} className={`flex items-center border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${selectedIds.includes(purchase.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
            <div className="w-16 px-4 flex-shrink-0">
                <input 
                    type="checkbox" 
                    checked={selectedIds.includes(purchase.id)} 
                    onChange={() => handleSelectOne(purchase.id)} 
                    disabled={!!isProcessing}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
            </div>
            <div className="w-32 px-4 flex-shrink-0 font-medium text-gray-900 dark:text-white truncate">
                {purchase.referenceNumber}
            </div>
            <div className="w-48 px-4 flex-shrink-0 truncate text-gray-600 dark:text-gray-300">
                {getSupplierName(purchase.supplierId)}
            </div>
            <div className="w-32 px-4 flex-shrink-0 text-gray-500 dark:text-gray-400 text-sm">
                {formatDate(purchase.date)}
            </div>
            <div className="w-32 px-4 flex-shrink-0 text-right font-bold text-gray-900 dark:text-white">
                {formatCurrency(purchase.grandTotal)}
            </div>
            <div className="w-32 px-4 flex-shrink-0 text-right text-green-600 dark:text-green-400 font-medium">
                {formatCurrency(purchase.paidAmount)}
            </div>
            <div className="w-32 px-4 flex-shrink-0 text-right text-red-600 dark:text-red-400 font-medium">
                {formatCurrency(purchase.grandTotal - purchase.paidAmount)}
            </div>
            <div className="w-32 px-4 flex-shrink-0">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusBadge(purchase.paymentStatus)}`}>
                    {purchase.paymentStatus}
                </span>
            </div>
            <div className="w-32 px-4 flex-shrink-0">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPurchaseStatusBadge(purchase.purchaseStatus)}`}>
                    {purchase.purchaseStatus}
                </span>
            </div>
            <div className="flex-1 px-4 flex justify-end">
                <DropdownMenu>
                    <DropdownMenuItem onClick={() => navigate(`/purchases/invoice/${purchase.id}`)}>
                        <DocumentTextIcon className="w-4 h-4 mr-2" /> Détails
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/purchases/edit/${purchase.id}`)}>
                        <EditIcon className="w-4 h-4 mr-2" /> Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenPaymentModal(purchase)}>
                        <PaymentIcon className="w-4 h-4 mr-2" /> Paiement
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(purchase)} className="text-red-600">
                        <DeleteIcon className="w-4 h-4 mr-2" /> Supprimer
                    </DropdownMenuItem>
                </DropdownMenu>
            </div>
        </div>
    );
};

const PurchasesPage: React.FC = () => {
    const { user } = useAuth();
    const { suppliers, warehouses, settings, suppliersLoading, recentPurchases, purchasesLoading, refreshData } = useData();
    const navigate = useNavigate();

    const [purchases, setPurchases] = useState<Purchase[]>([]);
    
    // Remove local state for suppliers/warehouses as we use context
    // const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    // const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [showAll, setShowAll] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    
    // Printing
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Journal_Achats_${new Date().toISOString().split('T')[0]}`,
    });
    
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        warehouseId: 'all',
        supplierId: 'all',
        paymentStatus: 'all',
        searchTerm: ''
    });

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [newPayment, setNewPayment] = useState({ 
        amount: 0, 
        method: 'Espèces' as PaymentMethod, 
        momoOperator: '',
        momoNumber: '',
        date: new Date().toISOString().split('T')[0],
        attachmentFile: null as File | null
    });
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const [limitCount, setLimitCount] = useState(50);

    const fetchData = async () => {
        if (!loading) setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('purchases')
                .select('*')
                .order('date', { ascending: false })
                .limit(limitCount);
            
            if (fetchError) throw fetchError;
            setPurchases(data || []);
        } catch (err: any) {
            console.error("Error fetching purchases data:", err);
            setError("Impossible de charger la liste des achats.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (limitCount <= 50 && recentPurchases.length > 0) {
             setPurchases(recentPurchases);
             setLoading(false);
             return;
        }
        fetchData();
    }, [limitCount, recentPurchases]);
    
    useEffect(() => { setCurrentPage(1); }, [filters]);
    useEffect(() => { setSelectedIds([]); }, [currentPage]);

    const userVisibleWarehouses = useMemo(() => {
        if (!user || !user.role) return [];
        if (user.role.name?.toLowerCase().includes('admin')) return warehouses;
        return warehouses.filter(wh => user.warehouseIds?.includes(wh.id));
    }, [user, warehouses]);

    const filteredPurchases = useMemo(() => {
        return purchases.filter(purchase => {
            const userWhIds = userVisibleWarehouses.map(wh => wh.id);
            if (purchase.warehouseId && !userWhIds.includes(purchase.warehouseId)) return false;

            const searchTermMatch = filters.searchTerm === '' || purchase.referenceNumber.toLowerCase().includes(filters.searchTerm.toLowerCase());
            const supplierMatch = filters.supplierId === 'all' || purchase.supplierId === filters.supplierId;
            const warehouseMatch = filters.warehouseId === 'all' || purchase.warehouseId === filters.warehouseId;
            const paymentStatusMatch = filters.paymentStatus === 'all' || purchase.paymentStatus === filters.paymentStatus;
            
            let dateMatch = true;
            if (filters.startDate) dateMatch = dateMatch && new Date(purchase.date) >= new Date(filters.startDate);
            if (filters.endDate) dateMatch = dateMatch && new Date(purchase.date) <= new Date(filters.endDate);

            return searchTermMatch && supplierMatch && warehouseMatch && paymentStatusMatch && dateMatch;
        });
    }, [purchases, filters, userVisibleWarehouses]);

    const paginatedPurchases = useMemo(() => {
        if (showAll) return filteredPurchases;
        return filteredPurchases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    }, [filteredPurchases, currentPage, itemsPerPage, showAll]);
    
    const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage);

    const supplierMap = useMemo(() => {
        return new Map(suppliers.map(s => [s.id, s.name]));
    }, [suppliers]);

    const getSupplierName = (id: string) => supplierMap.get(id) || 'N/A';
    
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };
    const handleSelectOne = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]);
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => setSelectedIds(e.target.checked ? paginatedPurchases.map(s => s.id) : []);

    const handleDelete = async (purchase: Purchase) => {
        if (isProcessing || !window.confirm(`Supprimer l'achat ${purchase.referenceNumber} ? Le stock sera restitué si l'achat était "Reçu".`)) return;
        setIsProcessing(purchase.id);
        setError(null);
        try {
            const { data: purchaseData, error: fetchError } = await supabase.from('purchases').select('*').eq('id', purchase.id).single();
            if (fetchError || !purchaseData) throw new Error("Achat déjà supprimé.");

            if (purchase.purchaseStatus === 'Reçu' && purchase.items.length > 0) {
                for (const item of purchase.items) {
                     const { data: product } = await supabase.from('products').select('*').eq('id', item.productId).single();
                     if (product && product.stockLevels) {
                         const stockLevels = [...product.stockLevels];
                         const whIndex = stockLevels.findIndex((sl: any) => sl.warehouseId === purchase.warehouseId);
                         if (whIndex !== -1) {
                             stockLevels[whIndex].quantity -= item.quantity;
                             if (stockLevels[whIndex].quantity < 0) stockLevels[whIndex].quantity = 0;
                             await supabase.from('products').update({ stockLevels }).eq('id', product.id);
                         }
                     }
                }
            }
            
            await supabase.from('purchase_payments').delete().eq('purchaseId', purchase.id);
            await supabase.from('purchases').delete().eq('id', purchase.id);

            setPurchases(prev => prev.filter(p => p.id !== purchase.id));
            refreshData(['purchases']);
        } catch (err: any) {
            setError(`Erreur de suppression: ${err.message}.`);
        } finally {
            setIsProcessing(null);
        }
    };
    
    const handleBulkDelete = async () => {
        if (!window.confirm(`Supprimer les ${selectedIds.length} achats sélectionnés ?`)) return;
        setIsBulkDeleteModalOpen(false);
        setIsProcessing('bulk-delete');
        setError(null);
        for (const purchaseId of selectedIds) {
            const purchaseToDelete = purchases.find(p => p.id === purchaseId);
            if (purchaseToDelete) {
                await handleDelete(purchaseToDelete);
                // Small delay to avoid hammering too hard if many
                await new Promise(r => setTimeout(r, 100));
            }
        }
        setSelectedIds([]);
        setIsProcessing(null);
    };

    const handleOpenPaymentModal = async (purchase: Purchase) => {
        setSelectedPurchase(purchase);
        setError(null);
        try {
            const { data, error: payError } = await supabase
                .from('purchase_payments')
                .select('*')
                .eq('purchaseId', purchase.id)
                .order('date', { ascending: false });
            
            if (payError) throw payError;
            setPayments(data || []);
        } catch (err) {
            setError("Impossible de charger les paiements.");
        }
        const remaining = purchase.grandTotal - purchase.paidAmount;
        setNewPayment({ amount: remaining > 0 ? remaining : 0, method: 'Espèces', momoOperator: '', momoNumber: '', date: new Date().toISOString().split('T')[0], attachmentFile: null });
        setIsPaymentModalOpen(true);
    };

    const handleAddPayment = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedPurchase || newPayment.amount <= 0 || !user) return setError("Montant invalide.");

        if (newPayment.method === 'Mobile Money' && (!newPayment.momoOperator || !newPayment.momoNumber)) {
            setError("Opérateur et numéro requis pour Mobile Money.");
            return;
        }

        const remaining = selectedPurchase.grandTotal - selectedPurchase.paidAmount;
        if (newPayment.amount > remaining + 0.01) return setError("Le paiement dépasse le solde.");
        
        setIsSubmittingPayment(true);
        setError(null);

        try {
            let attachmentUrl: string | undefined;
            if (newPayment.attachmentFile) {
                const fileExt = newPayment.attachmentFile.name.split('.').pop();
                const fileName = `${selectedPurchase.id}/${Date.now()}_payment.${fileExt}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('purchase-attachments')
                    .upload(fileName, newPayment.attachmentFile);
                
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage
                    .from('purchase-attachments')
                    .getPublicUrl(fileName);
                attachmentUrl = publicUrl;
            }

            const newPaid = selectedPurchase.paidAmount + newPayment.amount;
            let newStatus: PaymentStatus = newPaid >= selectedPurchase.grandTotal - 0.01 ? 'Payé' : 'Partiel';
            if (newPaid === 0) newStatus = 'En attente';

            await supabase.from('purchases').update({ 
                paidAmount: newPaid, 
                paymentStatus: newStatus 
            }).eq('id', selectedPurchase.id);

            const paymentId = crypto.randomUUID();
            const paymentData: any = { 
                id: paymentId,
                purchaseId: selectedPurchase.id,
                date: new Date(newPayment.date).toISOString(), 
                amount: newPayment.amount, 
                method: newPayment.method, 
                createdByUserId: user.uid, 
                attachmentUrl 
            };

            if (newPayment.method === 'Mobile Money') {
                paymentData.momoOperator = newPayment.momoOperator;
                paymentData.momoNumber = newPayment.momoNumber;
            }

            await supabase.from('purchase_payments').insert(paymentData);

            refreshData(['purchases']);
            setIsPaymentModalOpen(false);
        } catch (err: any) {
            setError(`Erreur: ${err.message}`);
        } finally {
            setIsSubmittingPayment(false);
        }
    };
    
    const areAllOnPageSelected = paginatedPurchases.length > 0 && selectedIds.length === paginatedPurchases.length;
    const getPaymentStatusBadge = (s: Purchase['paymentStatus']) => ({'Payé': 'bg-green-100 text-green-800','Partiel': 'bg-blue-100 text-blue-800','En attente': 'bg-yellow-100 text-yellow-800'}[s] || '');
    const getPurchaseStatusBadge = (s: Purchase['purchaseStatus']) => ({'Reçu': 'bg-green-100 text-green-800','Commandé': 'bg-blue-100 text-blue-800','En attente': 'bg-yellow-100 text-yellow-800'}[s] || '');
    const remainingBalance = selectedPurchase ? selectedPurchase.grandTotal - selectedPurchase.paidAmount : 0;

    // Calcul des totaux
    const totalGlobalAmount = useMemo(() => filteredPurchases.reduce((sum, p) => sum + p.grandTotal, 0), [filteredPurchases]);
    const totalGlobalPaid = useMemo(() => filteredPurchases.reduce((sum, p) => sum + p.paidAmount, 0), [filteredPurchases]);
    const totalGlobalBalance = useMemo(() => filteredPurchases.reduce((sum, p) => sum + (p.grandTotal - p.paidAmount), 0), [filteredPurchases]);

    const totalPageAmount = useMemo(() => paginatedPurchases.reduce((sum, p) => sum + p.grandTotal, 0), [paginatedPurchases]);
    const totalPagePaid = useMemo(() => paginatedPurchases.reduce((sum, p) => sum + p.paidAmount, 0), [paginatedPurchases]);
    const totalPageBalance = useMemo(() => paginatedPurchases.reduce((sum, p) => sum + (p.grandTotal - p.paidAmount), 0), [paginatedPurchases]);

    const itemData = useMemo(() => ({
        items: paginatedPurchases,
        functions: {
            selectedIds,
            handleSelectOne,
            getSupplierName,
            formatCurrency,
            formatDate,
            getPurchaseStatusBadge,
            getPaymentStatusBadge,
            navigate,
            handleDelete,
            handleOpenPaymentModal,
            isProcessing
        }
    }), [paginatedPurchases, selectedIds, handleSelectOne, getSupplierName, navigate, handleDelete, handleOpenPaymentModal, isProcessing]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white uppercase">Achats & Dépenses</h1>
                    <p className="text-sm text-gray-500">Gérez vos approvisionnements et factures fournisseurs</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => { setShowAll(!showAll); if (!showAll) setCurrentPage(1); }} 
                        className={`px-3 py-2 rounded-md font-bold uppercase text-xs transition-colors ${showAll ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        {showAll ? 'Vue paginée' : 'Tout afficher'}
                    </button>
                    {!showAll && (
                        <button onClick={() => setLimitCount(prev => prev + 500)} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 font-bold uppercase text-xs transition-colors">
                            Charger +
                        </button>
                    )}
                    <button 
                        onClick={() => setIsPrintModalOpen(true)}
                        className="flex items-center px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-black font-bold uppercase shadow-lg transition-all"
                    >
                        <PrintIcon className="w-5 h-5 mr-2" /> Imprimer
                    </button>
                    <button onClick={() => navigate('/purchases/new')} disabled={!!isProcessing} className="flex items-center px-4 py-2 text-sm text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:bg-primary-300"><PlusIcon className="w-5 h-5 mr-2" />Ajouter un Achat</button>
                </div>
            </div>

            <div className="mb-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex-shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input type="text" placeholder="Rechercher par Réf..." name="searchTerm" value={filters.searchTerm} onChange={handleFilterChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700"/>
                    <select name="supplierId" value={filters.supplierId} onChange={handleFilterChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700"><option value="all">Tous les fournisseurs</option>{suppliers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <select name="warehouseId" value={filters.warehouseId} onChange={handleFilterChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700"><option value="all">Tous les entrepôts</option>{userVisibleWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
                    <select name="paymentStatus" value={filters.paymentStatus} onChange={handleFilterChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700"><option value="all">Tous les paiements</option><option value="Payé">Payé</option><option value="Partiel">Partiel</option><option value="En attente">En attente</option></select>
                </div>
            </div>

            {loading ? <p>Chargement...</p> : error ? <p className="text-red-500">{error}</p> : (
            <>
            <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Header for both views */}
                <div className="bg-primary-600 text-white font-bold text-xs uppercase flex items-center h-12 flex-shrink-0">
                    <div className="w-16 px-4"><input type="checkbox" onChange={handleSelectAll} checked={areAllOnPageSelected} disabled={!!isProcessing}/></div>
                    <div className="w-32 px-4">Référence</div>
                    <div className="w-48 px-4">Fournisseur</div>
                    <div className="w-32 px-4">Date</div>
                    <div className="w-32 px-4 text-right">Total</div>
                    <div className="w-32 px-4 text-right">Payé</div>
                    <div className="w-32 px-4 text-right">Solde</div>
                    <div className="w-32 px-4">Paiement</div>
                    <div className="w-32 px-4">Statut Achat</div>
                    <div className="flex-1 px-4 text-right">Actions</div>
                </div>

                <div className="flex-1 min-h-0">
                    {showAll ? (
                        <SafeAutoSizer>
                            {({ height, width }: any) => (
                                <List
                                    height={height || 0}
                                    width={width || 0}
                                    itemCount={filteredPurchases.length}
                                    itemSize={60}
                                    itemData={itemData}
                                >
                                    {PurchaseRow as any}
                                </List>
                            )}
                        </SafeAutoSizer>
                    ) : (
                        <div className="overflow-auto h-full">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                                    {paginatedPurchases.map(p => (
                                        <tr key={p.id} className={selectedIds.includes(p.id) ? 'bg-primary-50 dark:bg-gray-700/50' : ''}>
                                            <td className="px-4 py-4 w-16"><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => handleSelectOne(p.id)} disabled={!!isProcessing}/></td>
                                            <td className="px-6 py-4 w-32">{p.referenceNumber}</td>
                                            <td className="px-6 py-4 w-48 truncate">{getSupplierName(p.supplierId)}</td>
                                            <td className="px-6 py-4 w-32">{formatDate(p.date)}</td>
                                            <td className="px-6 py-4 w-32 text-right font-bold">{formatCurrency(p.grandTotal)}</td>
                                            <td className="px-6 py-4 w-32 text-right text-green-600">{formatCurrency(p.paidAmount)}</td>
                                            <td className="px-6 py-4 w-32 text-right text-red-600">{formatCurrency(p.grandTotal - p.paidAmount)}</td>
                                            <td className="px-6 py-4 w-32">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusBadge(p.paymentStatus)}`}>
                                                    {p.paymentStatus}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 w-32">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPurchaseStatusBadge(p.purchaseStatus)}`}>
                                                    {p.purchaseStatus}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 flex-1 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuItem onClick={() => navigate(`/purchases/invoice/${p.id}`)}>
                                                        <DocumentTextIcon className="w-4 h-4 mr-2" /> Détails
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => navigate(`/purchases/edit/${p.id}`)}>
                                                        <EditIcon className="w-4 h-4 mr-2" /> Modifier
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleOpenPaymentModal(p)}>
                                                        <PaymentIcon className="w-4 h-4 mr-2" /> Paiement
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDelete(p)} className="text-red-600">
                                                        <DeleteIcon className="w-4 h-4 mr-2" /> Supprimer
                                                    </DropdownMenuItem>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            {!showAll && (
                <div className="mt-4 flex-shrink-0">
                    <Pagination 
                        currentPage={currentPage} 
                        totalPages={totalPages} 
                        onPageChange={setCurrentPage} 
                        itemsPerPage={itemsPerPage} 
                        totalItems={filteredPurchases.length} 
                    />
                </div>
            )}
            </>
            )}
            <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} title="Confirmer la suppression">
                <div className="p-6"><p>Supprimer les {selectedIds.length} achats sélectionnés ?</p></div>
                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 flex flex-row-reverse"><button onClick={handleBulkDelete} className="px-4 py-2 bg-red-600 text-white rounded">Confirmer</button><button onClick={() => setIsBulkDeleteModalOpen(false)} className="mr-2 px-4 py-2 bg-gray-200 rounded">Annuler</button></div>
            </Modal>
             <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={`Paiements pour l'Achat ${selectedPurchase?.referenceNumber}`}>
                {selectedPurchase && (<>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div><span className="block text-xs text-gray-500">Total</span><span className="text-lg font-bold">{formatCurrency(selectedPurchase.grandTotal)}</span></div>
                            <div><span className="block text-xs text-gray-500">Payé</span><span className="text-lg font-bold text-green-600">{formatCurrency(selectedPurchase.paidAmount)}</span></div>
                            <div><span className="block text-xs text-gray-500">Solde</span><span className="text-lg font-bold text-red-600">{formatCurrency(remainingBalance)}</span></div>
                        </div>
                        <div className="border-t pt-4"><h3 className="font-semibold mb-2">Historique</h3>
                            <div className="max-h-40 overflow-y-auto">{payments.length > 0 ? <ul className="divide-y dark:divide-gray-700">{payments.map(p => (<li key={p.id} className="py-2 flex flex-col">
                                <div className="flex justify-between">
                                    <span>{new Date(p.date).toLocaleDateString('fr-FR')} - {p.method}</span>
                                    <span className="font-medium">{formatCurrency(p.amount)}</span>
                                </div>
                                {p.method === 'Mobile Money' && (
                                    <span className="text-[10px] text-gray-500 uppercase font-black">{p.momoOperator} : {p.momoNumber}</span>
                                )}
                                {p.attachmentUrl && <a href={p.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 mt-1"><DownloadIcon className="w-4 h-4"/></a>}
                            </li>))}</ul> : <p>Aucun paiement.</p>}</div>
                        </div>
                        {remainingBalance > 0.01 && (
                        <form onSubmit={handleAddPayment} className="border-t pt-4 space-y-3">
                            <h3 className="font-semibold">Ajouter un paiement</h3>{error && <p className="text-sm text-red-500">{error}</p>}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div><label className="text-sm">Montant</label><input type="number" step="any" min="0.01" max={remainingBalance} value={newPayment.amount} onChange={e => setNewPayment(p => ({...p, amount: parseFloat(e.target.value) || 0}))} required className="w-full border rounded p-2 dark:bg-gray-700"/></div>
                                <div><label className="text-sm">Date</label><input type="date" value={newPayment.date} onChange={e => setNewPayment(p => ({...p, date: e.target.value}))} required className="w-full border rounded p-2 dark:bg-gray-700"/></div>
                            </div>
                            <div>
                                <label className="text-sm">Méthode</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                                    {['Espèces', 'Virement bancaire', 'Mobile Money', 'Autre'].map(m => (
                                        <button key={m} type="button" onClick={() => setNewPayment(p => ({...p, method: m as PaymentMethod}))} className={`py-2 text-[10px] font-bold uppercase border-2 rounded-lg ${newPayment.method === m ? 'bg-primary-600 text-white border-primary-600' : 'bg-white dark:bg-gray-700 text-gray-500'}`}>{m}</button>
                                    ))}
                                </div>
                            </div>
                            {newPayment.method === 'Mobile Money' && (
                                <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-300">
                                    <div><label className="text-xs">Opérateur</label><input type="text" value={newPayment.momoOperator} onChange={e => setNewPayment(p => ({...p, momoOperator: e.target.value}))} placeholder="MTN, Moov..." className="w-full border rounded p-2 dark:bg-gray-700 font-bold uppercase"/></div>
                                    <div><label className="text-xs">Numéro</label><input type="tel" value={newPayment.momoNumber} onChange={e => setNewPayment(p => ({...p, momoNumber: e.target.value}))} placeholder="00000000" className="w-full border rounded p-2 dark:bg-gray-700 font-bold"/></div>
                                </div>
                            )}
                            <div><label className="block text-sm">Pièce jointe</label><div className="mt-1 flex justify-center px-6 pt-2 pb-2 border-2 border-dashed rounded-md"><div className="space-y-1 text-center"><div className="flex text-sm"><label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-primary-600"><span>Télécharger un fichier</span><input id="file-upload" type="file" className="sr-only" onChange={e => setNewPayment(p => ({...p, attachmentFile: e.target.files ? e.target.files[0] : null}))} /></label></div>{newPayment.attachmentFile && <p className="text-xs">{newPayment.attachmentFile.name}</p>}</div></div></div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse -mx-6 -mb-6 mt-6">
                                <button type="submit" disabled={isSubmittingPayment} className="px-4 py-2 bg-primary-600 text-white rounded">{isSubmittingPayment ? 'Ajout...' : 'Ajouter Paiement'}</button>
                                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="mr-2 px-4 py-2 bg-gray-200 rounded">Annuler</button>
                            </div>
                        </form>
                        )}
                    </div>
                </>)}
            </Modal>

            <Modal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} title="Aperçu avant impression">
                <div className="p-6">
                    <div className="mb-4 flex justify-end">
                        <button 
                            onClick={() => { handlePrint(); setIsPrintModalOpen(false); }}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg font-bold"
                        >
                            Imprimer
                        </button>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto border border-gray-200 rounded-lg">
                        <PurchaseListPrint
                            ref={printRef}
                            purchases={filteredPurchases}
                            suppliers={suppliers}
                            settings={settings}
                            warehouses={warehouses}
                            period={{ start: filters.startDate, end: filters.endDate }}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PurchasesPage;
