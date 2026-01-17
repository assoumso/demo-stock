
import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { collection, getDocs, deleteDoc, doc, writeBatch, query, orderBy, where, runTransaction, limit, DocumentData, DocumentReference } from 'firebase/firestore';
// FIX: Imported modular storage functions to replace deprecated storage.ref() usage.
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Purchase, Supplier, Payment, PaymentMethod, PaymentStatus, Warehouse, Product } from '../types';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { PlusIcon, EditIcon, DeleteIcon, DocumentTextIcon, PaymentIcon, DownloadIcon, UploadIcon } from '../constants';
import DropdownMenu, { DropdownMenuItem } from '../components/DropdownMenu';

const PurchasesPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
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
            const purchasesQuery = query(collection(db, "purchases"), orderBy("date", "desc"), limit(limitCount));
            const [purchasesSnapshot, suppliersSnapshot, warehousesSnapshot] = await Promise.all([
                getDocs(purchasesQuery),
                getDocs(collection(db, "suppliers")),
                getDocs(collection(db, "warehouses")),
            ]);
            setPurchases(purchasesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase)));
            setSuppliers(suppliersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
            setWarehouses(warehousesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
        } catch (err) {
            console.error("Error fetching purchases data:", err);
            setError("Impossible de charger les données des achats.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [limitCount]);
    
    useEffect(() => { setCurrentPage(1); }, [filters]);
    useEffect(() => { setSelectedIds([]); }, [currentPage]);

    const userVisibleWarehouses = useMemo(() => {
        if (!user || !user.role) return [];
        if (user.role.name?.toLowerCase().includes('admin')) return warehouses;
        return warehouses.filter(wh => user.warehouseIds?.includes(wh.id));
    }, [user, warehouses]);

    const filteredPurchases = useMemo(() => {
        return purchases.filter(purchase => {
            const userWarehouseIds = userVisibleWarehouses.map(wh => wh.id);
            if (!userWarehouseIds.includes(purchase.warehouseId)) return false;

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

    const getSupplierName = (id: string) => suppliers.find(c => c.id === id)?.name || 'N/A';
    
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
            await runTransaction(db, async (transaction) => {
                const purchaseRef = doc(db, "purchases", purchase.id);
                const purchaseDoc = await transaction.get(purchaseRef);
                if (!purchaseDoc.exists()) throw new Error("Achat déjà supprimé.");
                const currentData = purchaseDoc.data() as Purchase;
                const stockUpdates: { ref: DocumentReference; stockLevels: any[] }[] = [];

                if (currentData.purchaseStatus === 'Reçu' && currentData.items.length > 0) {
                    const productRefs = currentData.items.map(item => doc(db, "products", item.productId));
                    const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));
                    
                    productDocs.forEach((pDoc, i) => {
                        if (pDoc.exists()) {
                            const pData = pDoc.data();
                            const stockLevels = [...(pData.stockLevels || [])];
                            const whIndex = stockLevels.findIndex(sl => sl.warehouseId === currentData.warehouseId);
                            if (whIndex !== -1) {
                                stockLevels[whIndex].quantity -= currentData.items[i].quantity;
                                if(stockLevels[whIndex].quantity < 0) stockLevels[whIndex].quantity = 0;
                                stockUpdates.push({ ref: productRefs[i], stockLevels });
                            }
                        }
                    });
                }
                
                stockUpdates.forEach(update => transaction.update(update.ref, { stockLevels: update.stockLevels }));
                transaction.delete(purchaseRef);
            });
            await fetchData();
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
                await new Promise(r => setTimeout(r, 500));
            }
        }
        await fetchData();
        setSelectedIds([]);
        setIsProcessing(null);
    };

    const handleOpenPaymentModal = async (purchase: Purchase) => {
        setSelectedPurchase(purchase);
        setError(null);
        try {
            const q = query(collection(db, "purchasePayments"), where("purchaseId", "==", purchase.id));
            const snap = await getDocs(q);
            const fetchedPayments = snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
            fetchedPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setPayments(fetchedPayments);
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
                const storageRef = ref(storage, `purchase_payments/${selectedPurchase.id}/${Date.now()}_${newPayment.attachmentFile.name}`);
                await uploadBytes(storageRef, newPayment.attachmentFile);
                attachmentUrl = await getDownloadURL(storageRef);
            }

            const purchaseRef = doc(db, 'purchases', selectedPurchase.id);
            await runTransaction(db, async (transaction) => {
                const purchaseDoc = await transaction.get(purchaseRef);
                if (!purchaseDoc.exists()) throw new Error("Achat introuvable.");

                const data = purchaseDoc.data();
                const newPaid = data.paidAmount + newPayment.amount;
                let newStatus: PaymentStatus = newPaid >= data.grandTotal - 0.01 ? 'Payé' : 'Partiel';
                if (newPaid === 0) newStatus = 'En attente';

                transaction.update(purchaseRef, { paidAmount: newPaid, paymentStatus: newStatus });

                const paymentData: Omit<Payment, 'id'> = { 
                    purchaseId: selectedPurchase.id, 
                    date: new Date(newPayment.date).toISOString(), 
                    amount: newPayment.amount, 
                    method: newPayment.method, 
                    createdByUserId: user.uid, 
                    ...(attachmentUrl && { attachmentUrl }) 
                };

                if (newPayment.method === 'Mobile Money') {
                    paymentData.momoOperator = newPayment.momoOperator;
                    paymentData.momoNumber = newPayment.momoNumber;
                }

                transaction.set(doc(collection(db, "purchasePayments")), paymentData as DocumentData);
            });
            await fetchData();
            setIsPaymentModalOpen(false);
        } catch (err: any) {
            setError(`Erreur: ${err.message}`);
        } finally {
            setIsSubmittingPayment(false);
        }
    };
    
    const formatCurrency = (v: number) => new Intl.NumberFormat('fr-FR').format(v).replace(/\u202f/g, ' ') + ' FCFA';
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

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Liste des Achats</h1>
                    <p className="text-gray-500 text-xs mt-1">Affichage des {limitCount} derniers achats</p>
                </div>
                 <div className="flex items-center space-x-2">
                    {selectedIds.length > 0 && <button onClick={() => setIsBulkDeleteModalOpen(true)} disabled={!!isProcessing} className="flex items-center px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-red-300"><DeleteIcon className="w-5 h-5 mr-2" />Supprimer ({selectedIds.length})</button>}
                    <button onClick={() => setLimitCount(prev => prev + 500)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 font-bold uppercase text-xs transition-colors">
                        Charger +
                    </button>
                    <button onClick={() => setShowAll(!showAll)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-bold uppercase text-xs transition-colors">
                        {showAll ? 'Vue par page' : 'Tout afficher'}
                    </button>
                    <button onClick={() => navigate('/purchases/new')} disabled={!!isProcessing} className="flex items-center px-4 py-2 text-sm text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:bg-primary-300"><PlusIcon className="w-5 h-5 mr-2" />Ajouter un Achat</button>
                </div>
            </div>

            <div className="mb-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input type="text" placeholder="Rechercher par Réf..." name="searchTerm" value={filters.searchTerm} onChange={handleFilterChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700"/>
                    <select name="supplierId" value={filters.supplierId} onChange={handleFilterChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700"><option value="all">Tous les fournisseurs</option>{suppliers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <select name="warehouseId" value={filters.warehouseId} onChange={handleFilterChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700"><option value="all">Tous les entrepôts</option>{userVisibleWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
                    <select name="paymentStatus" value={filters.paymentStatus} onChange={handleFilterChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700"><option value="all">Tous les paiements</option><option value="Payé">Payé</option><option value="Partiel">Partiel</option><option value="En attente">En attente</option></select>
                </div>
            </div>

            {loading ? <p>Chargement...</p> : error ? <p className="text-red-500">{error}</p> : (
            <>
            <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-primary-600"><tr>
                        <th className="px-4 py-3"><input type="checkbox" onChange={handleSelectAll} checked={areAllOnPageSelected} disabled={!!isProcessing}/></th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Référence</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Fournisseur</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Payé</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Solde</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Paiement</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Statut Achat</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-white uppercase">Actions</th>
                    </tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                        {paginatedPurchases.map(p => (
                            <tr key={p.id} className={selectedIds.includes(p.id) ? 'bg-primary-50 dark:bg-gray-700/50' : ''}>
                                <td className="px-4 py-4"><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => handleSelectOne(p.id)} disabled={!!isProcessing}/></td>
                                <td className="px-6 py-4">{p.referenceNumber}</td>
                                <td className="px-6 py-4">{getSupplierName(p.supplierId)}</td>
                                <td className="px-6 py-4">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                                <td className="px-6 py-4">{formatCurrency(p.grandTotal)}</td>
                                <td className="px-6 py-4">{formatCurrency(p.paidAmount)}</td>
                                <td className="px-6 py-4 font-bold text-red-600">{formatCurrency(p.grandTotal - p.paidAmount)}</td>
                                <td className="px-6 py-4"><span className={`px-2 inline-flex text-xs font-semibold rounded-full ${getPaymentStatusBadge(p.paymentStatus)}`}>{p.paymentStatus}</span></td>
                                <td className="px-6 py-4"><span className={`px-2 inline-flex text-xs font-semibold rounded-full ${getPurchaseStatusBadge(p.purchaseStatus)}`}>{p.purchaseStatus}</span></td>
                                <td className="px-6 py-4 text-right">
                                    {isProcessing === p.id ? <svg className="animate-spin h-5 w-5 text-primary-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : (
                                        <DropdownMenu>
                                            <DropdownMenuItem onClick={() => navigate(`/purchases/edit/${p.id}`)} disabled={!!isProcessing}><EditIcon className="w-4 h-4 mr-3" /> Modifier</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleOpenPaymentModal(p)} disabled={!!isProcessing}><PaymentIcon className="w-4 h-4 mr-3" /> Gérer paiements</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => navigate(`/purchases/invoice/${p.id}`)} disabled={!!isProcessing}><DocumentTextIcon className="w-4 h-4 mr-3" /> Voir la facture</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDelete(p)} className="text-red-600" disabled={!!isProcessing}><DeleteIcon className="w-4 h-4 mr-3" /> Supprimer</DropdownMenuItem>
                                        </DropdownMenu>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-200 dark:border-gray-700">
                        <tr className="bg-blue-50 dark:bg-blue-900/20 border-b dark:border-gray-700">
                            <td colSpan={4} className="px-6 py-3 text-right text-xs font-black uppercase text-gray-500">Total Page</td>
                            <td className="px-6 py-3 text-xs font-black text-gray-900 dark:text-white">{formatCurrency(totalPageAmount)}</td>
                            <td className="px-6 py-3 text-xs font-black text-green-600">{formatCurrency(totalPagePaid)}</td>
                            <td className="px-6 py-3 text-xs font-black text-red-600">{formatCurrency(totalPageBalance)}</td>
                            <td colSpan={3}></td>
                        </tr>
                        <tr className="bg-blue-100 dark:bg-blue-900/40">
                            <td colSpan={4} className="px-6 py-3 text-right text-xs font-black uppercase text-primary-600">Total Global</td>
                            <td className="px-6 py-3 text-xs font-black text-primary-600">{formatCurrency(totalGlobalAmount)}</td>
                            <td className="px-6 py-3 text-xs font-black text-green-600">{formatCurrency(totalGlobalPaid)}</td>
                            <td className="px-6 py-3 text-xs font-black text-red-600">{formatCurrency(totalGlobalBalance)}</td>
                            <td colSpan={3}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            {!showAll && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filteredPurchases.length} itemsPerPage={itemsPerPage} />}
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
        </div>
    );
};

export default PurchasesPage;
