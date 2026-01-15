import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, runTransaction, DocumentData, query, where, DocumentReference } from 'firebase/firestore';
import { Sale, SaleItem, Product, Customer, Warehouse, PaymentStatus, AppSettings } from '../types';
import { DeleteIcon, PlusIcon, WarningIcon } from '../constants';
import { useAuth } from '../hooks/useAuth';

type FormSale = Omit<Sale, 'id'>;

const SaleFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const isEditing = !!id;

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    
    const [formState, setFormState] = useState<FormSale>({
        referenceNumber: '',
        date: new Date().toISOString().split('T')[0],
        customerId: '',
        warehouseId: '',
        items: [],
        grandTotal: 0,
        paidAmount: 0,
        paymentStatus: 'En attente',
        saleStatus: 'En attente',
        paymentDeadlineDays: 0,
        notes: '',
    });
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [productSearch, setProductSearch] = useState('');
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [customerBalance, setCustomerBalance] = useState(0);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [customersSnap, warehousesSnap, productsSnap, settingsSnap] = await Promise.all([
                    getDocs(collection(db, "customers")),
                    getDocs(collection(db, "warehouses")),
                    getDocs(collection(db, "products")),
                    getDoc(doc(db, "settings", "app-config"))
                ]);
                
                const custList = customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
                setCustomers(custList);

                const whList = warehousesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse));
                setWarehouses(whList);

                setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));

                const settings = settingsSnap.exists() ? settingsSnap.data() as AppSettings : null;
                const prefix = settings?.saleInvoicePrefix || 'VNT-';

                if (isEditing) {
                    const saleDoc = await getDoc(doc(db, 'sales', id!));
                    if (saleDoc.exists()) {
                        const data = saleDoc.data() as FormSale;
                        setFormState(data);
                        const cust = custList.find(c => c.id === data.customerId);
                        if (cust) {
                            setCustomerSearchTerm(cust.name);
                            setSelectedCustomer(cust);
                        }
                    } else {
                        setError("Vente non trouvée.");
                    }
                } else {
                    setFormState(prev => ({
                        ...prev,
                        referenceNumber: `${prefix}${Date.now()}`,
                        customerId: '',
                    }));
                    setCustomerSearchTerm('');
                }
            } catch (err) {
                setError("Erreur de chargement des données.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, isEditing]);

    useEffect(() => {
        const fetchBalance = async () => {
            if (!formState.customerId) {
                setCustomerBalance(0);
                return;
            }
            try {
                const cust = customers.find(c => c.id === formState.customerId);
                let totalUnpaid = cust?.openingBalance || 0;

                const q = query(collection(db, "sales"), where("customerId", "==", formState.customerId));
                const snap = await getDocs(q);
                snap.docs.forEach(doc => {
                    const sale = doc.data() as Sale;
                    if (id && doc.id === id) return;
                    totalUnpaid += (sale.grandTotal - (sale.paidAmount || 0));
                });
                setCustomerBalance(totalUnpaid);
            } catch (e) {
                console.warn("Erreur calcul solde client");
            }
        };
        fetchBalance();
    }, [formState.customerId, id, customers]);
    
    const userVisibleWarehouses = useMemo(() => {
        if (!user) return [];
        if (user.role.name.toLowerCase().includes('admin')) return warehouses;
        return warehouses.filter(wh => user.warehouseIds?.includes(wh.id));
    }, [user, warehouses]);

    useEffect(() => {
        if (userVisibleWarehouses.length > 0) {
            const isSelectedWarehouseVisible = userVisibleWarehouses.some(wh => wh.id === formState.warehouseId);
            if (!formState.warehouseId || !isSelectedWarehouseVisible) {
                setFormState(prev => ({ ...prev, warehouseId: userVisibleWarehouses[0].id }));
            }
        }
    }, [userVisibleWarehouses, formState.warehouseId]);
    
    const calculateTotals = (items: SaleItem[]): number => items.reduce((sum, item) => sum + item.subtotal, 0);

    useEffect(() => {
        const grandTotal = calculateTotals(formState.items);
        let paymentStatus: PaymentStatus = 'En attente';
        if (formState.paidAmount >= grandTotal && grandTotal > 0) {
            paymentStatus = 'Payé';
        } else if (formState.paidAmount > 0) {
            paymentStatus = 'Partiel';
        }
        setFormState(prev => ({ ...prev, grandTotal, paymentStatus }));
    }, [formState.items, formState.paidAmount]);
    
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const isNumber = ['paidAmount', 'paymentDeadlineDays'].includes(name);
        setFormState(prev => ({ ...prev, [name]: isNumber ? parseFloat(value) || 0 : value }));
    };

    const handleItemChange = (index: number, field: 'quantity' | 'price', value: number) => {
        const newItems = [...formState.items];
        const item = newItems[index];
        item[field] = value;
        item.subtotal = item.quantity * item.price;
        setFormState(prev => ({ ...prev, items: newItems }));
    };

    const addProductToSale = (product: Product) => {
        if (!formState.items.some(item => item.productId === product.id)) {
            const newItem: SaleItem = { productId: product.id, quantity: 1, price: product.price || 0, subtotal: product.price || 0 };
            setFormState(prev => ({ ...prev, items: [...prev.items, newItem]}));
        }
        setProductSearch('');
    };

    const removeProduct = (index: number) => {
        setFormState(prev => ({...prev, items: prev.items.filter((_, i) => i !== index)}));
    };

    const handleFormSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        if (formState.items.length === 0) { setError("Veuillez ajouter au moins un produit."); return; }
        if (!formState.customerId) { setError("Veuillez sélectionner un client."); return; }

        if (selectedCustomer?.isCreditLimited) {
            const newDebt = formState.grandTotal - formState.paidAmount;
            const projectedBalance = customerBalance + newDebt;
            if (projectedBalance > (selectedCustomer.creditLimit || 0)) {
                if (!window.confirm(`ALERTE LIMITE DE CRÉDIT : Le solde total du client (${formatCurrency(projectedBalance)}) va dépasser sa limite autorisée. Continuer ?`)) return;
            }
        }

        const finalSaleData: any = { ...formState };
        if (formState.paymentDeadlineDays && formState.paymentDeadlineDays > 0) {
            const dueDate = new Date(formState.date);
            dueDate.setDate(dueDate.getDate() + Number(formState.paymentDeadlineDays));
            finalSaleData.paymentDueDate = dueDate.toISOString();
        } else {
            finalSaleData.paymentDueDate = null;
        }

        try {
            await runTransaction(db, async (transaction) => {
                const saleRef = isEditing ? doc(db, 'sales', id!) : doc(collection(db, "sales"));
                
                // --- PHASE 1 : READS ---
                const originalSaleDoc = isEditing ? await transaction.get(saleRef) : null;
                const originalSale = originalSaleDoc?.exists() ? originalSaleDoc.data() as Sale : null;

                const allProductIds = Array.from(new Set([
                    ...finalSaleData.items.map((i: SaleItem) => i.productId),
                    ...(originalSale?.items.map(i => i.productId) || [])
                ]));
                
                const productSnapshots = await Promise.all(
                    allProductIds.map(pid => transaction.get(doc(db, 'products', pid)))
                );

                // --- PHASE 2 : LOGIC & CALCULATIONS ---
                const wasCompleted = originalSale?.saleStatus === 'Complétée';
                const isNowCompleted = finalSaleData.saleStatus === 'Complétée';
                const stockUpdates: { ref: DocumentReference, newStockLevels: any[] }[] = [];

                if (wasCompleted || isNowCompleted) {
                    allProductIds.forEach((productId, idx) => {
                        const productSnap = productSnapshots[idx];
                        if (!productSnap.exists()) return;
                        
                        const productData = productSnap.data() as Product;
                        if (productData.type === 'service') return;

                        let stockLevels = [...(productData.stockLevels || [])];
                        const newItem = finalSaleData.items.find((i: SaleItem) => i.productId === productId);
                        const originalItem = originalSale?.items.find(i => i.productId === productId);

                        // 1. Recharger le stock si c'était complété avant
                        if (wasCompleted && originalItem) {
                            const whIdx = stockLevels.findIndex(sl => sl.warehouseId === originalSale!.warehouseId);
                            if (whIdx > -1) stockLevels[whIdx].quantity += originalItem.quantity;
                        }

                        // 2. Déduire le stock si c'est complété maintenant
                        if (isNowCompleted && newItem) {
                            const whIdx = stockLevels.findIndex(sl => sl.warehouseId === finalSaleData.warehouseId);
                            if (whIdx > -1) {
                                stockLevels[whIdx].quantity -= newItem.quantity;
                            } else {
                                stockLevels.push({ warehouseId: finalSaleData.warehouseId, quantity: -newItem.quantity });
                            }
                        }

                        stockUpdates.push({ ref: doc(db, 'products', productId), newStockLevels: stockLevels });
                    });
                }

                // --- PHASE 3 : WRITES ---
                stockUpdates.forEach(update => {
                    transaction.update(update.ref, { stockLevels: update.newStockLevels });
                });

                if (!isEditing && finalSaleData.paidAmount > 0 && user) {
                    const paymentRef = doc(collection(db, "salePayments"));
                    transaction.set(paymentRef, {
                        saleId: saleRef.id,
                        date: new Date().toISOString(),
                        amount: finalSaleData.paidAmount,
                        method: 'Espèces',
                        createdByUserId: user.uid,
                        note: 'Paiement initial à la vente'
                    });
                } else if (isEditing && originalSale && finalSaleData.paidAmount !== originalSale.paidAmount && user) {
                    const diff = finalSaleData.paidAmount - originalSale.paidAmount;
                    if (diff !== 0) {
                        transaction.set(doc(collection(db, "salePayments")), {
                            saleId: saleRef.id,
                            date: new Date().toISOString(),
                            amount: diff,
                            method: 'Autre',
                            createdByUserId: user.uid,
                            note: 'Ajustement manuel du montant payé sur facture'
                        });
                    }
                }

                if (isEditing) transaction.update(saleRef, finalSaleData);
                else transaction.set(saleRef, finalSaleData);
            });
            navigate('/sales');
        } catch (err: any) {
            setError(`Erreur: ${err.message}`);
        }
    };

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 5);
    }, [productSearch, products]);
    
    const filteredCustomers = useMemo(() => {
        if (!customerSearchTerm) return [];
        return customers.filter(c => c.name.toLowerCase().includes(customerSearchTerm.toLowerCase())).slice(0, 5);
    }, [customerSearchTerm, customers]);

    const handleQuickAddCustomer = () => {
        navigate('/customers/new', { state: { returnTo: location.pathname } });
    };

    const getProductName = (productId: string) => products.find(p => p.id === productId)?.name || 'Produit inconnu';
    const formatCurrency = (value?: number) => new Intl.NumberFormat('fr-FR').format(value || 0) + ' Fcfa';
    const inputFormClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all focus:ring-primary-500 focus:border-primary-500";

    if (loading) return <div className="text-center p-8 text-gray-400 font-bold animate-pulse">Initialisation...</div>;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white uppercase tracking-tight">{isEditing ? `Modifier la Vente` : "Créer une Vente"}</h1>
                    <button type="button" onClick={() => navigate('/sales')} className="text-sm text-gray-500 font-bold hover:text-gray-900 dark:hover:white uppercase">&larr; Retour</button>
                </div>
                
                {error && <div className="p-3 my-2 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900/40 dark:text-red-300 font-bold text-center border border-red-200">{error}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div><label className="block text-xs font-black uppercase text-gray-400">Date</label><input type="date" name="date" value={formState.date} onChange={handleFormChange} required className={inputFormClasses}/></div>
                    <div><label className="block text-xs font-black uppercase text-gray-400">Réf. Vente</label><input type="text" name="referenceNumber" value={formState.referenceNumber} onChange={handleFormChange} required className={inputFormClasses}/></div>
                    <div className="relative">
                        <label className="block text-xs font-black uppercase text-gray-400">Client</label>
                        <div className="flex items-center">
                            <input type="text" value={customerSearchTerm} onChange={e => { setCustomerSearchTerm(e.target.value); setFormState(prev => ({...prev, customerId: ''})); setSelectedCustomer(null); }} placeholder="Rechercher un client" className={`${inputFormClasses} rounded-r-none`} />
                            <button type="button" onClick={handleQuickAddCustomer} className="px-3 py-2 bg-primary-600 text-white rounded-r-md hover:bg-primary-700 h-10 mt-1" title="Nouveau Client"><PlusIcon className="w-5 h-5"/></button>
                        </div>
                        {filteredCustomers.length > 0 && !formState.customerId && (
                            <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 shadow-2xl rounded-md py-1 border dark:border-gray-700 overflow-hidden">
                                {filteredCustomers.map(c => <li key={c.id} onClick={() => { setFormState(prev => ({...prev, customerId: c.id})); setCustomerSearchTerm(c.name); setSelectedCustomer(c); }} className="cursor-pointer px-4 py-3 hover:bg-primary-50 dark:hover:bg-primary-900/30 text-sm font-medium border-b last:border-0 dark:border-gray-700">{c.name}</li>)}
                            </ul>
                        )}
                    </div>
                    <div><label className="block text-xs font-black uppercase text-gray-400">Entrepôt</label><select name="warehouseId" value={formState.warehouseId} onChange={handleFormChange} required className={inputFormClasses}>{userVisibleWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
                    <div><label className="block text-xs font-black uppercase text-orange-500">Délai Paiement (Jours)</label><input type="number" name="paymentDeadlineDays" min="0" placeholder="Ex: 7" value={formState.paymentDeadlineDays || ''} onChange={handleFormChange} className={`${inputFormClasses} border-orange-200`}/></div>
                </div>

                <div className="border-t pt-4 dark:border-gray-700 relative">
                    <label className="block text-xs font-black uppercase text-gray-400 mb-1">Ajouter des produits</label>
                    <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Scanner ou taper le nom / SKU..." className={inputFormClasses} />
                    {filteredProducts.length > 0 && (<ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 shadow-2xl max-h-60 rounded-md py-1 border dark:border-gray-700 overflow-auto">{filteredProducts.map(p => (
                        <li key={p.id} onClick={() => addProductToSale(p)} className="cursor-pointer px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center border-b last:border-0 dark:border-gray-700">
                            <div><p className="font-bold text-sm">{p.name}</p><p className="text-[10px] text-gray-400 font-black">{p.sku}</p></div>
                        </li>
                    ))}</ul>)}
                </div>
                
                <div className="overflow-x-auto"><table className="min-w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50"><tr>
                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-gray-500 w-2/5">Produit</th>
                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-gray-500">Prix</th>
                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-gray-500">Quantité</th>
                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-gray-500">Sous-total</th>
                        <th></th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {formState.items.map((item, index) => (<tr key={index}>
                            <td className="px-4 py-3 text-sm font-bold">{getProductName(item.productId)}</td>
                            <td className="py-2"><input type="number" step="any" value={item.price} onChange={e => handleItemChange(index, 'price', parseFloat(e.target.value))} className={`w-32 ${inputFormClasses}`}/></td>
                            <td className="py-2"><input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value))} className={`w-24 ${inputFormClasses}`}/></td>
                            <td className="px-4 py-3 text-sm font-black">{formatCurrency(item.subtotal)}</td>
                            <td className="px-4 text-right"><button type="button" onClick={() => removeProduct(index)} className="text-gray-300 hover:text-red-600"><DeleteIcon className="w-5 h-5"/></button></td>
                        </tr>))}
                    </tbody>
                </table></div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t-2 border-dashed">
                    <div className="md:col-span-2 space-y-4">
                        <div><label className="block text-xs font-black uppercase tracking-widest text-gray-400">Statut de la vente</label><select name="saleStatus" value={formState.saleStatus} onChange={handleFormChange} className={inputFormClasses}><option>En attente</option><option>Complétée</option></select></div>
                        <div><label className="block text-xs font-black uppercase tracking-widest text-green-600">Montant versé (Acompte)</label><input type="number" name="paidAmount" value={formState.paidAmount || ''} onChange={handleFormChange} className={`${inputFormClasses} border-green-200 text-green-700 font-bold`}/></div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Note / Observation</label>
                            <textarea name="notes" rows={3} value={formState.notes || ''} onChange={handleFormChange} className={inputFormClasses} placeholder="Observations, détails supplémentaires..."></textarea>
                        </div>
                    </div>
                    <div className="space-y-4 bg-gray-50 dark:bg-gray-900/30 p-4 rounded-2xl border dark:border-gray-700">
                        <div className="pt-2">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Total Général</h3>
                            <p className="text-3xl font-black text-primary-600 mt-1">{formatCurrency(formState.grandTotal)}</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-3 pt-6">
                    <button type="button" onClick={() => navigate('/sales')} className="px-6 py-3 text-sm font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200">Annuler</button>
                    <button type="submit" className="px-10 py-3 text-sm text-white bg-primary-600 rounded-xl font-black shadow-lg hover:bg-primary-700 active:scale-95 transition-all">Enregistrer la vente</button>
                </div>
            </form>
        </div>
    );
};

export default SaleFormPage;