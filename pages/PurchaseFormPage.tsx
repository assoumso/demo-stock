
import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, runTransaction, DocumentData, DocumentReference } from 'firebase/firestore';
import { Purchase, PurchaseItem, Product, Supplier, Warehouse, AppSettings } from '../types';
import { DeleteIcon, PlusIcon } from '../constants';
import Modal from '../components/Modal';


type FormPurchase = Omit<Purchase, 'id'>;

const PurchaseFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditing = !!id;

    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    
    const [formState, setFormState] = useState<FormPurchase>({
        referenceNumber: '',
        date: new Date().toISOString().split('T')[0],
        supplierId: '',
        warehouseId: '',
        items: [],
        shippingCost: 0,
        grandTotal: 0,
        paidAmount: 0,
        paymentStatus: 'En attente',
        purchaseStatus: 'En attente',
        notes: '',
    });
    
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [productSearch, setProductSearch] = useState('');

    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [newSupplierState, setNewSupplierState] = useState<Partial<Supplier>>({ name: '', contactPerson: '', phone: '', email: '', address: '' });
    const [isAddingSupplier, setIsAddingSupplier] = useState(false);
    const [supplierSearchTerm, setSupplierSearchTerm] = useState('');


    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [suppliersSnap, warehousesSnap, productsSnap, settingsSnap] = await Promise.all([
                    getDocs(collection(db, "suppliers")),
                    getDocs(collection(db, "warehouses")),
                    getDocs(collection(db, "products")),
                    getDoc(doc(db, "settings", "app-config"))
                ]);
                const supList = suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
                setSuppliers(supList);

                const whList = warehousesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse));
                setWarehouses(whList);

                setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));

                const settings = settingsSnap.exists() ? settingsSnap.data() as AppSettings : null;
                const prefix = settings?.purchaseInvoicePrefix || 'ACH-';

                if (isEditing) {
                    const purchaseDoc = await getDoc(doc(db, 'purchases', id!));
                    if (purchaseDoc.exists()) {
                        const data = purchaseDoc.data() as FormPurchase;
                        setFormState(data);
                        const sup = supList.find(s => s.id === data.supplierId);
                        if (sup) setSupplierSearchTerm(sup.name);
                    } else {
                        setError("Achat non trouvé.");
                    }
                } else {
                    setFormState(prev => ({
                        ...prev,
                        referenceNumber: `${prefix}${Date.now()}`,
                        supplierId: '',
                        warehouseId: whList.length > 0 ? whList[0].id : '',
                        purchaseStatus: 'Reçu' 
                    }));
                    setSupplierSearchTerm('');
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
    
    const calculateTotals = (items: PurchaseItem[], shipping: number): number => {
        const itemsTotal = items.reduce((sum, item) => sum + item.subtotal, 0);
        return itemsTotal + shipping;
    };

    useEffect(() => {
        const grandTotal = calculateTotals(formState.items, formState.shippingCost || 0);
        setFormState(prev => ({ ...prev, grandTotal }));
    }, [formState.items, formState.shippingCost]);
    
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const isNumber = ['shippingCost'].includes(name);
        setFormState(prev => ({ ...prev, [name]: isNumber ? parseFloat(value) || 0 : value }));
    };

    const handleItemChange = (index: number, field: 'quantity' | 'cost', value: number) => {
        const newItems = [...formState.items];
        const item = newItems[index];
        item[field] = Number(value);
        item.subtotal = item.quantity * item.cost;
        setFormState(prev => ({ ...prev, items: newItems }));
    };

    const addProductToPurchase = (product: Product) => {
        if (!formState.items.some(item => item.productId === product.id)) {
            const newItem: PurchaseItem = {
                productId: product.id,
                quantity: 1,
                cost: product.cost || 0,
                subtotal: product.cost || 0,
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
        setIsSubmitting(true);

        if (formState.items.length === 0) {
            setError("Veuillez ajouter au moins un produit.");
            setIsSubmitting(false);
            return;
        }
        if (!formState.supplierId) {
            setError("Veuillez sélectionner un fournisseur.");
            setIsSubmitting(false);
            return;
        }
    
        try {
            await runTransaction(db, async (transaction) => {
                const purchaseRef = isEditing ? doc(db, 'purchases', id!) : doc(collection(db, "purchases"));
                
                // --- PHASE 1 : TOUTES LES LECTURES (READS) ---
                const originalPurchaseDoc = isEditing ? await transaction.get(purchaseRef) : null;
                const originalPurchase = originalPurchaseDoc?.exists() ? originalPurchaseDoc.data() as Purchase : null;

                const allProductIds = Array.from(new Set([
                    ...formState.items.map(i => i.productId), 
                    ...(originalPurchase?.items.map(i => i.productId) || [])
                ]));

                // Lecture de tous les produits d'un coup
                const productSnapshots = await Promise.all(
                    allProductIds.map(pid => transaction.get(doc(db, 'products', pid)))
                );

                // --- PHASE 2 : CALCULS ET LOGIQUE (LOGIC) ---
                const wasReceived = originalPurchase?.purchaseStatus === 'Reçu';
                const isNowReceived = formState.purchaseStatus === 'Reçu';
                
                const stockUpdates: { ref: DocumentReference, newStockLevels: any[] }[] = [];

                if (wasReceived || isNowReceived) {
                    allProductIds.forEach((productId, index) => {
                        const productDoc = productSnapshots[index];
                        if (!productDoc.exists()) return;
                        
                        const productData = productDoc.data() as Product;
                        if (productData.type === 'service') return;
                        
                        let stockLevels = [...(productData.stockLevels || [])];
                        const newItem = formState.items.find(i => i.productId === productId);
                        const originalItem = originalPurchase?.items.find(i => i.productId === productId);
                        
                        // 1. Annuler l'ancien stock si c'était déjà reçu
                        if (wasReceived && originalItem) {
                            const oldWarehouseId = originalPurchase!.warehouseId;
                            const oldWhIndex = stockLevels.findIndex(sl => sl.warehouseId === oldWarehouseId);
                            if (oldWhIndex > -1) {
                                stockLevels[oldWhIndex].quantity -= originalItem.quantity;
                            }
                        }

                        // 2. Ajouter le nouveau stock si c'est maintenant reçu
                        if (isNowReceived && newItem) {
                            const newWarehouseId = formState.warehouseId;
                            const newWhIndex = stockLevels.findIndex(sl => sl.warehouseId === newWarehouseId);
                            if (newWhIndex > -1) {
                                stockLevels[newWhIndex].quantity += newItem.quantity;
                            } else {
                                stockLevels.push({ warehouseId: newWarehouseId, quantity: newItem.quantity });
                            }
                        }

                        stockUpdates.push({
                            ref: doc(db, 'products', productId),
                            newStockLevels: stockLevels
                        });
                    });
                }

                // --- PHASE 3 : TOUTES LES ÉCRITURES (WRITES) ---
                // Mettre à jour les stocks de tous les produits calculés
                stockUpdates.forEach(update => {
                    transaction.update(update.ref, { stockLevels: update.newStockLevels });
                });

                // Enregistrer l'achat
                if (isEditing) {
                    transaction.update(purchaseRef, formState as DocumentData);
                } else {
                    transaction.set(purchaseRef, formState as DocumentData);
                }
            });
            navigate('/purchases');
        } catch (err: any) {
            setError(`Erreur lors de l'enregistrement : ${err.message}`);
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        return products.filter(p =>
            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.sku.toLowerCase().includes(productSearch.toLowerCase())
        ).slice(0, 5);
    }, [productSearch, products]);
    
    const filteredSuppliers = useMemo(() => {
        if (!supplierSearchTerm) return [];
        return suppliers.filter(s => s.name.toLowerCase().includes(supplierSearchTerm.toLowerCase())).slice(0, 5);
    }, [supplierSearchTerm, suppliers]);

    const handleAddSupplier = async (e: FormEvent) => {
        e.preventDefault();
        if (!newSupplierState.name) return;
        setIsAddingSupplier(true);
        try {
            const newSupplierData = {
                name: newSupplierState.name || '',
                contactPerson: newSupplierState.contactPerson || '',
                phone: newSupplierState.phone || '',
                email: newSupplierState.email || '',
                address: newSupplierState.address || '',
            };
            const docRef = await addDoc(collection(db, "suppliers"), newSupplierData);
            const newSupplier = { id: docRef.id, ...newSupplierData };
            setSuppliers(prev => [...prev, newSupplier]);
            setFormState(prev => ({...prev, supplierId: newSupplier.id}));
            setSupplierSearchTerm(newSupplier.name);
            setIsSupplierModalOpen(false);
            setNewSupplierState({ name: '', contactPerson: '', phone: '', email: '', address: '' });
        } catch (err) {
            setError("Erreur lors de la création du fournisseur.");
        } finally {
            setIsAddingSupplier(false);
        }
    };
    
    const getProductName = (productId: string) => products.find(p => p.id === productId)?.name || 'Produit inconnu';

    if (loading) return <div className="text-center p-8">Chargement du formulaire...</div>;

    const inputFormClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-primary-500 focus:border-primary-500 outline-none";
    const selectFormClasses = "mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white";
    const formatCurrency = (value?: number) => new Intl.NumberFormat('fr-FR').format(value || 0) + ' Fcfa';

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white uppercase tracking-tight">{isEditing ? `Modifier l'Achat` : "Créer un Achat"}</h1>
                    <button type="button" onClick={() => navigate('/purchases')} className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-bold">&larr; Retour</button>
                </div>
                {error && <div className="p-3 my-2 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900/40 dark:text-red-300 border border-red-200 font-bold text-center">{error}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div><label className="block text-xs font-black uppercase text-gray-400">Date</label><input type="date" name="date" value={formState.date} onChange={handleFormChange} required className={inputFormClasses}/></div>
                    <div><label className="block text-xs font-black uppercase text-gray-400">Réf. Achat</label><input type="text" name="referenceNumber" value={formState.referenceNumber} onChange={handleFormChange} required className={inputFormClasses}/></div>
                    <div className="relative">
                        <label className="block text-xs font-black uppercase text-gray-400">Fournisseur</label>
                        <div className="flex items-center">
                            <input type="text" value={supplierSearchTerm} onChange={e => { setSupplierSearchTerm(e.target.value); setFormState(prev => ({...prev, supplierId: ''})) }} placeholder="Rechercher un fournisseur" className={`${inputFormClasses} rounded-r-none`} />
                            <button type="button" onClick={() => setIsSupplierModalOpen(true)} className="px-3 py-2 bg-primary-600 text-white rounded-r-md hover:bg-primary-700 h-10 mt-1"><PlusIcon className="w-5 h-5"/></button>
                        </div>
                        {filteredSuppliers.length > 0 && !formState.supplierId && (
                            <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 shadow-2xl rounded-md py-1 border dark:border-gray-700">
                                {filteredSuppliers.map(s => <li key={s.id} onClick={() => { setFormState(prev => ({...prev, supplierId: s.id})); setSupplierSearchTerm(s.name); }} className="cursor-pointer px-3 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/40 text-sm font-bold border-b last:border-0">{s.name}</li>)}
                            </ul>
                        )}
                    </div>
                    <div><label className="block text-xs font-black uppercase text-gray-400">Entrepôt de réception</label><select name="warehouseId" value={formState.warehouseId} onChange={handleFormChange} required className={selectFormClasses}>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
                </div>

                <div className="border-t pt-4 dark:border-gray-700 relative">
                    <label className="block text-xs font-black uppercase text-gray-400 mb-1">Ajouter des articles</label>
                    <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Taper le nom ou SKU du produit..." className={inputFormClasses} />
                    {filteredProducts.length > 0 && (<ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 shadow-2xl max-h-60 rounded-md py-1 border dark:border-gray-700 overflow-auto">{filteredProducts.map(p => ( <li key={p.id} onClick={() => addProductToPurchase(p)} className="cursor-pointer px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center border-b last:border-0">
                        <div><p className="font-bold text-sm">{p.name}</p><p className="text-[10px] text-gray-400 font-black">{p.sku}</p></div>
                        <span className="text-[10px] font-black uppercase bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">HT: {formatCurrency(p.cost)}</span>
                    </li>))}</ul>)}
                </div>
                
                <div className="overflow-x-auto"><table className="min-w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50"><tr>
                        <th className="px-4 py-2 text-left text-[10px] font-black uppercase text-gray-500 w-2/5 tracking-widest">Désignation</th>
                        <th className="px-4 py-2 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">Coût Unitaire</th>
                        <th className="px-4 py-2 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">Quantité</th>
                        <th className="px-4 py-2 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">Sous-total</th>
                        <th></th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {formState.items.map((item, index) => (<tr key={index}>
                            <td className="px-4 py-3 text-sm font-bold text-gray-800 dark:text-gray-200">{getProductName(item.productId)}</td>
                            <td><input type="number" step="any" value={item.cost} onChange={e => handleItemChange(index, 'cost', parseFloat(e.target.value))} className={`w-32 ${inputFormClasses}`}/></td>
                            <td><input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value))} className={`w-24 ${inputFormClasses}`}/></td>
                            <td className="px-4 py-2 text-sm font-black">{formatCurrency(item.subtotal)}</td>
                            <td className="text-right px-4"><button type="button" onClick={() => removeProduct(index)} className="text-gray-300 hover:text-red-600 transition-colors"><DeleteIcon className="w-5 h-5"/></button></td>
                        </tr>))}
                        {formState.items.length === 0 && (
                            <tr><td colSpan={5} className="py-8 text-center text-gray-400 italic text-sm">Aucun article dans la liste d'achat.</td></tr>
                        )}
                    </tbody>
                </table></div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t-2 border-dashed dark:border-gray-700">
                    <div className="md:col-span-2 space-y-4">
                        <div>
                            <label className="block text-xs font-black uppercase text-primary-600">Statut de réception (Actualise le stock)</label>
                            <select name="purchaseStatus" value={formState.purchaseStatus} onChange={handleFormChange} className={`${selectFormClasses} border-primary-500 ring-2 ring-primary-100`}>
                                <option value="En attente">En attente (Stock non touché)</option>
                                <option value="Commandé">Commandé (Stock non touché)</option>
                                <option value="Reçu">Reçu (Stock incrémenté immédiatement)</option>
                            </select>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border">
                            <label className="block text-xs font-black uppercase text-gray-400 mb-2">Notes administratives</label>
                            <textarea name="notes" value={formState.notes || ''} onChange={handleFormChange} rows={2} className={inputFormClasses} placeholder="Conditions particulières, numéro de bon de livraison..."></textarea>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div><label className="block text-xs font-black uppercase text-gray-400">Frais d'approche / Livraison</label><input type="number" name="shippingCost" value={formState.shippingCost || ''} onChange={handleFormChange} className={inputFormClasses}/></div>

                        <div className="p-5 bg-primary-600 text-white rounded-2xl shadow-xl">
                            <h3 className="text-xs font-black uppercase opacity-80 tracking-widest">Total de la facture</h3>
                            <p className="text-3xl font-black mt-1">{formatCurrency(formState.grandTotal)}</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-3 pt-6">
                    <button type="button" onClick={() => navigate('/purchases')} className="px-6 py-3 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 uppercase tracking-widest">Annuler</button>
                    <button type="submit" disabled={isSubmitting} className="px-10 py-3 text-sm text-white bg-primary-600 rounded-xl font-black shadow-lg hover:bg-primary-700 active:scale-95 disabled:opacity-50 uppercase tracking-widest">
                        {isSubmitting ? 'Traitement...' : (isEditing ? 'Mettre à jour l\'achat' : 'Enregistrer l\'achat')}
                    </button>
                </div>
            </form>
            
             <Modal isOpen={isSupplierModalOpen} onClose={() => setIsSupplierModalOpen(false)} title="Nouveau Fournisseur">
                <form onSubmit={handleAddSupplier} className="p-6 space-y-4">
                    <input type="text" placeholder="Nom de la société" value={newSupplierState.name || ''} onChange={e => setNewSupplierState(prev => ({ ...prev, name: e.target.value }))} required className="w-full border rounded-xl p-3 dark:bg-gray-700"/>
                    <div className="grid grid-cols-2 gap-4">
                        <input type="text" placeholder="Contact" value={newSupplierState.contactPerson || ''} onChange={e => setNewSupplierState(prev => ({...prev, contactPerson: e.target.value}))} className="w-full border rounded-xl p-3 dark:bg-gray-700"/>
                        <input type="tel" placeholder="Téléphone" value={newSupplierState.phone || ''} onChange={e => setNewSupplierState(prev => ({...prev, phone: e.target.value}))} className="w-full border rounded-xl p-3 dark:bg-gray-700"/>
                    </div>
                    <input type="email" placeholder="Email" value={newSupplierState.email || ''} onChange={e => setNewSupplierState(prev => ({...prev, email: e.target.value}))} className="w-full border rounded-xl p-3 dark:bg-gray-700"/>
                    <input type="text" placeholder="Adresse" value={newSupplierState.address || ''} onChange={e => setNewSupplierState(prev => ({...prev, address: e.target.value}))} className="w-full border rounded-xl p-3 dark:bg-gray-700"/>
                    <div className="flex justify-end space-x-2 pt-4">
                        <button type="button" onClick={() => setIsSupplierModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg font-bold text-sm uppercase">Annuler</button>
                        <button type="submit" disabled={isAddingSupplier} className="bg-primary-600 text-white px-6 py-2 rounded-lg font-black text-sm uppercase shadow-lg">
                            {isAddingSupplier ? 'Création...' : 'Ajouter le fournisseur'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default PurchaseFormPage;
