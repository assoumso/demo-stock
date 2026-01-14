
import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, runTransaction, DocumentData, query, where } from 'firebase/firestore';
import { Sale, SaleItem, Product, Customer, Warehouse, PaymentStatus, AppSettings } from '../types';
import { DeleteIcon, PlusIcon, WarningIcon } from '../constants';
import Modal from '../components/Modal';
import { useAuth } from '../hooks/useAuth';

type FormSale = Omit<Sale, 'id'>;

const SaleFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
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
    });
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [productSearch, setProductSearch] = useState('');

    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [newCustomerState, setNewCustomerState] = useState<Partial<Customer>>({ name: '', email: '', phone: '' });
    const [isAddingCustomer, setIsAddingCustomer] = useState(false);
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
                const q = query(collection(db, "sales"), where("customerId", "==", formState.customerId));
                const snap = await getDocs(q);
                let totalUnpaid = 0;
                snap.docs.forEach(doc => {
                    const sale = doc.data() as Sale;
                    if (id && doc.id === id) return;
                    if (sale.paymentStatus !== 'Payé') {
                        totalUnpaid += (sale.grandTotal - (sale.paidAmount || 0));
                    }
                });
                setCustomerBalance(totalUnpaid);
            } catch (e) {
                console.warn("Erreur calcul solde client");
            }
        };
        fetchBalance();
    }, [formState.customerId, id]);
    
    const userVisibleWarehouses = useMemo(() => {
        if (!user) return [];
        if (user.role.name.toLowerCase().includes('admin')) {
            return warehouses;
        }
        const userWarehouseIds = user.warehouseIds || [];
        return warehouses.filter(wh => userWarehouseIds.includes(wh.id));
    }, [user, warehouses]);

    useEffect(() => {
        if (userVisibleWarehouses.length > 0) {
            const isSelectedWarehouseVisible = userVisibleWarehouses.some(wh => wh.id === formState.warehouseId);
            if (!formState.warehouseId || !isSelectedWarehouseVisible) {
                setFormState(prev => ({
                    ...prev,
                    warehouseId: userVisibleWarehouses[0].id,
                }));
            }
        } else {
            setFormState(prev => ({ ...prev, warehouseId: '' }));
        }
    }, [userVisibleWarehouses, formState.warehouseId]);
    
    const calculateTotals = (items: SaleItem[]): number => {
        return items.reduce((sum, item) => sum + item.subtotal, 0);
    };

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

    const getAvailableStock = (productId: string, warehouseId: string): number => {
        const product = products.find(p => p.id === productId);
        if (product?.type === 'service') return Infinity;
        if (!product || !product.stockLevels) return 0;
        const stockLevel = product.stockLevels.find(sl => sl.warehouseId === warehouseId);
        return stockLevel ? stockLevel.quantity : 0;
    };

    const getTotalStock = (product: Product): number => {
        if (product.type === 'service') return Infinity;
        if (!product || !product.stockLevels) return 0;
        return product.stockLevels.reduce((sum, level) => sum + level.quantity, 0);
    };

    const addProductToSale = (product: Product) => {
        if (!formState.items.some(item => item.productId === product.id)) {
            const newItem: SaleItem = {
                productId: product.id,
                quantity: 1,
                price: product.price || 0,
                subtotal: product.price || 0,
            };
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
                if (!window.confirm(`ALERTE LIMITE DE CRÉDIT : Le solde total du client (${formatCurrency(projectedBalance)}) va dépasser sa limite autorisée (${formatCurrency(selectedCustomer.creditLimit || 0)}). Voulez-vous quand même forcer cette vente ?`)) {
                    return;
                }
            }
        }

        for (const item of formState.items) {
            const availableStock = getAvailableStock(item.productId, formState.warehouseId);
            if (item.quantity > availableStock) {
                setError(`Stock insuffisant pour le produit "${getProductName(item.productId)}". Quantité demandée : ${item.quantity}, disponible : ${availableStock}.`);
                return;
            }
        }

        // --- PRÉPARATION DES DONNÉES SANS UNDEFINED ---
        const finalSaleData: any = { ...formState };
        
        if (formState.paymentDeadlineDays && formState.paymentDeadlineDays > 0) {
            const dueDate = new Date(formState.date);
            dueDate.setDate(dueDate.getDate() + Number(formState.paymentDeadlineDays));
            finalSaleData.paymentDueDate = dueDate.toISOString();
        } else {
            // Firestore n'autorise pas undefined, on utilise null
            finalSaleData.paymentDueDate = null;
        }

        try {
            await runTransaction(db, async (transaction) => {
                const saleRef = isEditing ? doc(db, 'sales', id!) : doc(collection(db, "sales"));
                const originalSaleDoc = isEditing ? await transaction.get(saleRef) : null;
                const originalSale = originalSaleDoc?.exists() ? originalSaleDoc.data() as Sale : null;

                for (const item of finalSaleData.items) {
                    const productRef = doc(db, 'products', item.productId);
                    const productDoc = await transaction.get(productRef);
                    if (!productDoc.exists()) continue;
                    
                    const productData = productDoc.data() as Product;
                    if (productData.type === 'service') continue;

                    const stockLevels = [...(productData.stockLevels || [])];
                    let stockChange = 0;
                    const wasCompleted = originalSale?.saleStatus === 'Complétée';
                    const isNowCompleted = finalSaleData.saleStatus === 'Complétée';
                    const originalItem = originalSale?.items.find(i => i.productId === item.productId);

                    if (!wasCompleted && isNowCompleted) {
                        stockChange = -item.quantity;
                    } else if (wasCompleted && !isNowCompleted) {
                        stockChange = (originalItem?.quantity || 0);
                    } else if (wasCompleted && isNowCompleted) {
                        stockChange = (originalItem?.quantity || 0) - item.quantity;
                    }

                    if (stockChange !== 0) {
                        const whIndex = stockLevels.findIndex(sl => sl.warehouseId === finalSaleData.warehouseId);
                        if (whIndex > -1) {
                            stockLevels[whIndex].quantity += stockChange;
                        } else if (stockChange < 0) {
                             stockLevels.push({ warehouseId: finalSaleData.warehouseId, quantity: stockChange });
                        }
                        transaction.update(productRef, { stockLevels });
                    }
                }

                if (isEditing) {
                    transaction.update(saleRef, finalSaleData);
                } else {
                    transaction.set(saleRef, finalSaleData);
                }
            });
            navigate('/sales');
        } catch (err: any) {
            setError(`Erreur de sauvegarde: ${err.message}`);
        }
    };

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        return products.filter(p =>
            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.sku.toLowerCase().includes(productSearch.toLowerCase())
        ).slice(0, 5);
    }, [productSearch, products]);
    
    const filteredCustomers = useMemo(() => {
        if (!customerSearchTerm) return [];
        return customers.filter(c => c.name.toLowerCase().includes(customerSearchTerm.toLowerCase())).slice(0, 5);
    }, [customerSearchTerm, customers]);

    const handleAddCustomer = async (e: FormEvent) => {
        e.preventDefault();
        if (!newCustomerState.name) return;
        setIsAddingCustomer(true);
        try {
            const newCustomerData = {
                name: newCustomerState.name || '',
                phone: newCustomerState.phone || '',
                email: newCustomerState.email || '',
                isCreditLimited: false,
                creditLimit: 0
            };
            const docRef = await addDoc(collection(db, "customers"), newCustomerData);
            const newCustomer = { id: docRef.id, ...newCustomerData };
            setCustomers(prev => [...prev, newCustomer]);
            setFormState(prev => ({...prev, customerId: newCustomer.id}));
            setCustomerSearchTerm(newCustomer.name);
            setSelectedCustomer(newCustomer);
            setIsCustomerModalOpen(false);
            setNewCustomerState({ name: '', phone: '', email: '' });
        } catch (err) {
            setError("Erreur lors de la création du client.");
        } finally {
            setIsAddingCustomer(false);
        }
    };
    
    const getProductName = (productId: string) => products.find(p => p.id === productId)?.name || 'Produit inconnu';

    if (loading) return <div className="text-center p-8">Chargement du formulaire...</div>;
    const inputFormClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all focus:ring-primary-500 focus:border-primary-500";
    const selectFormClasses = "mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white";
    const formatCurrency = (value?: number) => new Intl.NumberFormat('fr-FR').format(value || 0) + ' Fcfa';

    const currentNewDebt = formState.grandTotal - formState.paidAmount;
    const totalProjectedDebt = customerBalance + currentNewDebt;
    const isCreditExceeded = selectedCustomer?.isCreditLimited && totalProjectedDebt > (selectedCustomer.creditLimit || 0);

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white uppercase tracking-tight">{isEditing ? `Modifier la Vente` : "Créer une Vente"}</h1>
                    <button type="button" onClick={() => navigate('/sales')} className="text-sm text-gray-500 font-bold hover:text-gray-900 dark:hover:white uppercase">&larr; Retour</button>
                </div>
                
                {error && <div className="p-3 my-2 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900/40 dark:text-red-300 font-bold text-center border border-red-200">{error}</div>}

                {isCreditExceeded && (
                    <div className="bg-red-600 text-white p-4 rounded-xl shadow-xl flex items-center animate-pulse">
                        <div className="bg-white/20 p-2 rounded-lg mr-4"><WarningIcon className="w-6 h-6"/></div>
                        <div>
                            <p className="font-black text-sm uppercase">Dépassement de Limite de Crédit</p>
                            <p className="text-xs opacity-90">Ce client a un solde actuel de <span className="font-black">{formatCurrency(customerBalance)}</span>. Avec cette vente, son crédit passera à <span className="font-black underline">{formatCurrency(totalProjectedDebt)}</span> alors que son plafond est de <span className="font-black">{formatCurrency(selectedCustomer?.creditLimit || 0)}</span>.</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div><label className="block text-xs font-black uppercase text-gray-400">Date</label><input type="date" name="date" value={formState.date} onChange={handleFormChange} required className={inputFormClasses}/></div>
                    <div><label className="block text-xs font-black uppercase text-gray-400">Réf. Vente</label><input type="text" name="referenceNumber" value={formState.referenceNumber} onChange={handleFormChange} required className={inputFormClasses}/></div>
                    <div className="relative">
                        <label className="block text-xs font-black uppercase text-gray-400">Client</label>
                        <div className="flex items-center">
                            <input type="text" value={customerSearchTerm} onChange={e => { setCustomerSearchTerm(e.target.value); setFormState(prev => ({...prev, customerId: ''})); setSelectedCustomer(null); }} placeholder="Rechercher un client" className={`${inputFormClasses} rounded-r-none`} />
                            <button type="button" onClick={() => setIsCustomerModalOpen(true)} className="px-3 py-2 bg-primary-600 text-white rounded-r-md hover:bg-primary-700 h-10 mt-1"><PlusIcon className="w-5 h-5"/></button>
                        </div>
                        {filteredCustomers.length > 0 && !formState.customerId && (
                            <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 shadow-2xl rounded-md py-1 border dark:border-gray-700 overflow-hidden">
                                {filteredCustomers.map(c => <li key={c.id} onClick={() => { setFormState(prev => ({...prev, customerId: c.id})); setCustomerSearchTerm(c.name); setSelectedCustomer(c); }} className="cursor-pointer px-4 py-3 hover:bg-primary-50 dark:hover:bg-primary-900/30 text-sm font-medium border-b last:border-0 dark:border-gray-700">{c.name} {c.isCreditLimited && <span className="text-[10px] ml-2 text-orange-600 font-bold">(Limite: {formatCurrency(c.creditLimit)})</span>}</li>)}
                            </ul>
                        )}
                    </div>
                    <div><label className="block text-xs font-black uppercase text-gray-400">Entrepôt</label><select name="warehouseId" value={formState.warehouseId} onChange={handleFormChange} required className={selectFormClasses}>{userVisibleWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
                    <div><label className="block text-xs font-black uppercase text-orange-500">Délai Paiement (Jours)</label><input type="number" name="paymentDeadlineDays" min="0" placeholder="Ex: 7" value={formState.paymentDeadlineDays || ''} onChange={handleFormChange} className={`${inputFormClasses} border-orange-200 dark:border-orange-900/30`}/></div>
                </div>

                <div className="border-t pt-4 dark:border-gray-700 relative">
                    <label className="block text-xs font-black uppercase text-gray-400 mb-1">Ajouter des produits</label>
                    <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Scanner ou taper le nom / SKU..." className={inputFormClasses} />
                    {filteredProducts.length > 0 && (<ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 shadow-2xl max-h-60 rounded-md py-1 border dark:border-gray-700 overflow-auto">{filteredProducts.map(p => {
                        const stock = getAvailableStock(p.id, formState.warehouseId);
                        const totalStock = getTotalStock(p);
                        return (
                            <li key={p.id} onClick={() => addProductToSale(p)} className="cursor-pointer px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center border-b last:border-0 dark:border-gray-700">
                                <div>
                                    <p className="font-bold text-sm">{p.name}</p>
                                    <p className="text-[10px] text-gray-400 uppercase font-black">{p.sku}</p>
                                </div>
                                {p.type === 'service' ? <span className={`text-[10px] font-black uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full`}>Service</span> : <div className="text-right"><span className={`text-[10px] font-black uppercase ${stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} px-2 py-0.5 rounded-full`}>Dispo: {stock}</span><p className="text-[10px] text-gray-400 mt-1">Total: {totalStock}</p></div>}
                            </li>
                        )
                    })}</ul>)}
                </div>
                
                <div className="overflow-x-auto"><table className="min-w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50"><tr>
                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-gray-500 w-2/5 tracking-widest">Produit</th>
                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">Prix</th>
                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">Quantité</th>
                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">Sous-total</th>
                        <th></th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {formState.items.map((item, index) => {
                             const availableStock = getAvailableStock(item.productId, formState.warehouseId);
                             const isStockInsufficient = item.quantity > availableStock;
                            return (<tr key={index}>
                                <td className="px-4 py-3 text-sm font-bold text-gray-800 dark:text-gray-200">{getProductName(item.productId)}</td>
                                <td className="py-2"><input type="number" step="any" value={item.price} onChange={e => handleItemChange(index, 'price', parseFloat(e.target.value))} className={`w-32 ${inputFormClasses}`}/></td>
                                <td className="py-2">
                                    <input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value))} className={`w-24 ${inputFormClasses} ${isStockInsufficient ? 'border-red-500 focus:ring-red-500 focus:border-red-500 ring-2 ring-red-100' : ''}`}/>
                                    {isStockInsufficient && <p className="text-red-500 text-[10px] font-bold mt-1 uppercase tracking-tighter">Stock insuffisant (Dispo: {availableStock})</p>}
                                </td>
                                <td className="px-4 py-3 text-sm font-black text-gray-900 dark:text-white">{formatCurrency(item.subtotal)}</td>
                                <td className="px-4 text-right"><button type="button" onClick={() => removeProduct(index)} className="text-gray-300 hover:text-red-600 transition-colors"><DeleteIcon className="w-5 h-5"/></button></td>
                            </tr>)
                        })}
                        {formState.items.length === 0 && (
                            <tr><td colSpan={5} className="py-8 text-center text-gray-400 italic text-sm">Aucun produit ajouté.</td></tr>
                        )}
                    </tbody>
                </table></div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t-2 border-dashed dark:border-gray-700">
                    <div className="md:col-span-2 space-y-4">
                        <div><label className="block text-xs font-black uppercase text-gray-400">Statut de la vente</label><select name="saleStatus" value={formState.saleStatus} onChange={handleFormChange} className={selectFormClasses}><option>En attente</option><option>Complétée</option></select></div>
                        <div><label className="block text-xs font-black uppercase text-green-600">Montant payé (Encaissé)</label><input type="number" name="paidAmount" placeholder="0" value={formState.paidAmount || ''} onChange={handleFormChange} className={`${inputFormClasses} border-green-200 dark:border-green-900/30 text-green-700 font-bold`}/></div>
                    </div>
                    <div className="space-y-4 bg-gray-50 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <div>
                             <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Statut Paiement</label>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${formState.paymentStatus === 'Payé' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                {formState.paymentStatus}
                            </span>
                        </div>
                        <div className="pt-2">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Total Général</h3>
                            <p className="text-3xl font-black text-primary-600 dark:text-primary-400 mt-1">{formatCurrency(formState.grandTotal)}</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-3 pt-6">
                    <button type="button" onClick={() => navigate('/sales')} className="px-6 py-3 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all uppercase tracking-widest">Annuler</button>
                    <button type="submit" className="px-10 py-3 text-sm text-white bg-primary-600 rounded-xl font-black shadow-lg hover:bg-primary-700 active:scale-95 transition-all uppercase tracking-widest">{isEditing ? 'Mettre à jour' : 'Enregistrer la vente'}</button>
                </div>
            </form>
            
             <Modal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title="Nouveau Client">
                <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
                    <input type="text" placeholder="Nom Complet" value={newCustomerState.name || ''} onChange={e => setNewCustomerState(prev => ({ ...prev, name: e.target.value }))} required className="w-full border rounded-xl p-3 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500 transition-all"/>
                    <div className="grid grid-cols-2 gap-4">
                        <input type="tel" placeholder="Téléphone" value={newCustomerState.phone || ''} onChange={e => setNewCustomerState(prev => ({...prev, phone: e.target.value}))} className="w-full border rounded-xl p-3 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500 transition-all"/>
                        <input type="email" placeholder="Email" value={newCustomerState.email || ''} onChange={e => setNewCustomerState(prev => ({...prev, email: e.target.value}))} className="w-full border rounded-xl p-3 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-primary-500 transition-all"/>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                        <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg font-bold text-sm uppercase">Fermer</button>
                        <button type="submit" disabled={isAddingCustomer} className="bg-primary-600 text-white px-6 py-2 rounded-lg font-black text-sm uppercase shadow-lg hover:bg-primary-700 transition-all">{isAddingCustomer ? 'Traitement...' : 'Ajouter Client'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default SaleFormPage;
