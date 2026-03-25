import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import { Purchase, PurchaseItem, Product, Supplier, Warehouse, AppSettings, Quote } from '../types';
import { DeleteIcon, PlusIcon } from '../constants';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../hooks/useAuth';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import Modal from '../components/Modal';
import { formatCurrency } from '../utils/formatters';

type FormPurchase = Omit<Purchase, 'id'>;

const PurchaseFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const isEditing = !!id;
    const fromQuote = location.state?.fromQuote as Quote | undefined;

    const { suppliers, warehouses, products, settings, loading: dataLoading, refreshData } = useData();
    const { user } = useAuth();
    const { addToast } = useToast();
    
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
    const [createdSuppliers, setCreatedSuppliers] = useState<Supplier[]>([]);

    const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
    const productBySku = useMemo(() => new Map(products.map(p => [p.sku.toLowerCase(), p])), [products]);
    const productByUpc = useMemo(() => new Map(products.filter(p => p.upc_ean).map(p => [p.upc_ean!, p])), [products]);

    // Gestion du scanner code-barres
    useBarcodeScanner({
        onScan: (barcode) => {
            console.log("Scanned barcode (Purchase):", barcode);
            let product = productBySku.get(barcode.toLowerCase());
            
            if (!product) {
                product = productByUpc.get(barcode);
            }

            if (product) {
                addProductToPurchase(product);
            } else {
                console.warn("Produit non trouvé pour le code:", barcode);
            }
        },
        minLength: 3
    });

    useEffect(() => {
        const initForm = async () => {
            if (dataLoading) return; // Wait for global data

            if (isEditing) {
                setLoading(true);
                try {
                    if (!id) return;
                    const { data, error: fetchError } = await supabase
                        .from('purchases')
                        .select('*')
                        .eq('id', id)
                        .single();
                    
                    if (!fetchError && data) {
                        setFormState(data);
                        const sup = suppliers.find(s => s.id === data.supplierId);
                        if (sup) setSupplierSearchTerm(sup.name);
                    } else {
                        setError("Achat introuvable.");
                    }
                } catch (err) {
                    setError("Impossible de charger les détails de l'achat.");
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            } else if (fromQuote) {
                // Convert Quote items to Purchase items
                const purchaseItems: PurchaseItem[] = fromQuote.items.map(qItem => {
                    const product = productMap.get(qItem.productId);
                    const cost = product?.cost || 0; 
                    return {
                        productId: qItem.productId,
                        quantity: qItem.quantity,
                        cost: cost,
                        subtotal: qItem.quantity * cost
                    };
                });
                
                const grandTotal = purchaseItems.reduce((sum, i) => sum + i.subtotal, 0);

                const prefix = settings?.purchaseInvoicePrefix || 'ACH-';
                setFormState(prev => ({
                    ...prev,
                    referenceNumber: `${prefix}${Date.now()}`,
                    supplierId: '', 
                    warehouseId: warehouses.length > 0 ? warehouses[0].id : '',
                    items: purchaseItems,
                    grandTotal: grandTotal,
                    purchaseStatus: 'En attente', 
                    notes: `Généré depuis le devis ${fromQuote.referenceNumber}. ${fromQuote.notes || ''}`
                }));
                setLoading(false);
            } else {
                const prefix = settings?.purchaseInvoicePrefix || 'ACH-';
                if (!formState.referenceNumber) {
                    setFormState(prev => ({
                        ...prev,
                        referenceNumber: `${prefix}${Date.now()}`,
                        supplierId: '',
                        warehouseId: warehouses.length > 0 ? warehouses[0].id : '',
                        purchaseStatus: 'Reçu' 
                    }));
                    setSupplierSearchTerm('');
                } else if (!formState.warehouseId && warehouses.length > 0) {
                    setFormState(prev => ({ ...prev, warehouseId: warehouses[0].id }));
                }
                setLoading(false);
            }
        };
        initForm();
    }, [id, isEditing, dataLoading, fromQuote, settings, suppliers, warehouses, productMap]);
    
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
        setFormState(prev => {
            const existingItemIndex = prev.items.findIndex(item => item.productId === product.id);
            if (existingItemIndex >= 0) {
                const newItems = [...prev.items];
                const item = { ...newItems[existingItemIndex] };
                item.quantity += 1;
                item.subtotal = item.quantity * item.cost;
                newItems[existingItemIndex] = item;
                return { ...prev, items: newItems };
            } else {
                const newItem: PurchaseItem = {
                    productId: product.id,
                    productName: product.name,
                    quantity: 1,
                    cost: product.cost || 0,
                    subtotal: product.cost || 0,
                };
                return { ...prev, items: [...prev.items, newItem]};
            }
        });
        setProductSearch('');
    };

    const removeProduct = (index: number) => {
        setFormState(prev => ({...prev, items: prev.items.filter((_, i) => i !== index)}));
    };

    const generatePurchaseDetails = () => {
        const items = formState.items.map((item, index) => {
            const product = products.find(p => p.id === item.productId);
            return (
                <div key={index} className="flex justify-between text-xs py-1 border-b border-gray-300 dark:border-gray-600">
                    <span>{product?.name || 'Produit'}</span>
                    <span className="font-semibold">{item.quantity}x {formatCurrency(item.cost)}</span>
                </div>
            );
        });
        return (
            <div className="space-y-2">
                <div className="font-semibold text-xs text-blue-700 dark:text-blue-400 mb-2">Articles commandés:</div>
                {items}
                <div className="flex justify-between text-xs font-bold pt-2 border-t border-gray-400 dark:border-gray-500 mt-2">
                    <span>Total</span>
                    <span>{formatCurrency(formState.grandTotal)}</span>
                </div>
            </div>
        );
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
    
        const now = new Date();
        const purchaseToSave: any = { 
            ...formState,
            date: formState.date.includes('T') ? formState.date : `${formState.date}T${now.toISOString().split('T')[1]}`
        };

        try {
            let originalPurchase: Purchase | null = null;
            if (isEditing) {
                const { data: fetchOrig } = await supabase.from('purchases').select('*').eq('id', id).single();
                if (fetchOrig) {
                    originalPurchase = fetchOrig as Purchase;
                }
            }

            const allProductIds = Array.from(new Set([
                ...formState.items.map(i => i.productId), 
                ...(originalPurchase?.items.map(i => i.productId) || [])
            ]));
            
            const { data: currentProducts, error: prodError } = await supabase
                .from('products')
                .select('*')
                .in('id', allProductIds);
            
            if (prodError) throw prodError;

            const wasReceived = originalPurchase?.purchaseStatus === 'Reçu';
            const isNowReceived = formState.purchaseStatus === 'Reçu';
            
            if (wasReceived || isNowReceived) {
                for (const productId of allProductIds) {
                    const productData = (currentProducts || []).find(p => p.id === productId);
                    if (!productData || productData.type === 'service') continue;
                    
                    let stockLevels = [...(productData.stockLevels || [])];
                    const newItem = formState.items.find(i => i.productId === productId);
                    const originalItem = originalPurchase?.items.find(i => i.productId === productId);
                    
                    let changed = false;

                    if (wasReceived && originalItem) {
                         const oldWarehouseId = originalPurchase!.warehouseId;
                         const oldWhIndex = stockLevels.findIndex(sl => sl.warehouseId === oldWarehouseId);
                         if (oldWhIndex > -1) {
                             stockLevels[oldWhIndex].quantity -= originalItem.quantity;
                             changed = true;
                         }
                    }

                    if (isNowReceived && newItem) {
                        const newWarehouseId = formState.warehouseId;
                        const newWhIndex = stockLevels.findIndex(sl => sl.warehouseId === newWarehouseId);
                        if (newWhIndex > -1) {
                            stockLevels[newWhIndex].quantity += newItem.quantity;
                        } else {
                            stockLevels.push({ warehouseId: newWarehouseId, quantity: newItem.quantity });
                        }
                        changed = true;
                    }

                    if (changed) {
                        await supabase.from('products').update({ stockLevels }).eq('id', productId);
                    }
                }
            }

            let purchaseId = id;
            if (isEditing) {
                if (!id) throw new Error("ID manquant");
                await supabase.from('purchases').update(purchaseToSave).eq('id', id);
                addToast('Achat modifié avec succès', 'success', undefined, generatePurchaseDetails());
            } else {
                purchaseId = crypto.randomUUID();
                const newPurchase = { ...purchaseToSave, id: purchaseId };
                await supabase.from('purchases').insert(newPurchase);
                addToast('Achat enregistré avec succès', 'success', undefined, generatePurchaseDetails());
            }

            if (fromQuote && purchaseId) {
                await supabase.from('quotes').update({
                    convertedPurchaseId: purchaseId,
                    status: 'Converti'
                }).eq('id', fromQuote.id);
            }

            await refreshData(['purchases', 'products']);
            
            setTimeout(() => {
                navigate('/purchases');
            }, 500);
            
        } catch (err: any) {
            const msg = `Erreur lors de l'enregistrement : ${err.message}`;
            setError(msg);
            addToast(msg, 'error');
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
    
    const allSuppliers = useMemo(() => {
        // Combiner les fournisseurs du contexte et ceux créés localement pour un affichage immédiat
        const map = new Map(suppliers.map(s => [s.id, s]));
        createdSuppliers.forEach(s => map.set(s.id, s));
        return Array.from(map.values());
    }, [suppliers, createdSuppliers]);

    const filteredSuppliers = useMemo(() => {
        if (!supplierSearchTerm) return [];
        return allSuppliers.filter(s => s.name.toLowerCase().includes(supplierSearchTerm.toLowerCase())).slice(0, 5);
    }, [supplierSearchTerm, allSuppliers]);

    const handleAddSupplier = async (e: FormEvent) => {
        e.preventDefault();
        if (!newSupplierState.name) return;
        setIsAddingSupplier(true);
        try {
            const newId = crypto.randomUUID();
            const newSupplierData = {
                id: newId,
                name: newSupplierState.name || '',
                // contactPerson: newSupplierState.contactPerson || '', // Temporairement désactivé pour éviter les erreurs de schéma
                phone: newSupplierState.phone || '',
                email: newSupplierState.email || '',
                address: newSupplierState.address || '',
                notes: newSupplierState.contactPerson ? `Contact: ${newSupplierState.contactPerson}` : undefined,
                businessName: '',
                city: '',
                nif: '',
                rccm: '',
                website: '',
                openingBalance: 0,
                creditBalance: 0,
            };
            
            await supabase.from('suppliers').insert(newSupplierData);
            
            // Reconstitution de l'objet Supplier pour l'état local
            const newSupplier: any = {
                ...newSupplierData,
                contactPerson: newSupplierState.contactPerson
            };
            
            // Ajouter localement pour une disponibilité immédiate
            setCreatedSuppliers(prev => [...prev, newSupplier]);
            
            setFormState(prev => ({...prev, supplierId: newId}));
            setSupplierSearchTerm(newSupplier.name);
            setIsSupplierModalOpen(false);
            setNewSupplierState({ name: '', contactPerson: '', phone: '', email: '', address: '' });
            
            // Rafraîchir en arrière-plan
            refreshData(['suppliers']).catch(console.error);
        } catch (err: any) {
            console.error("Erreur création fournisseur:", err);
            setError(`Erreur lors de la création du fournisseur: ${err.message || JSON.stringify(err)}`);
        } finally {
            setIsAddingSupplier(false);
        }
    };
    
    const getProductName = (productId: string) => productMap.get(productId)?.name || 'Produit inconnu';

    if (loading) return <div className="text-center p-8">Chargement du formulaire...</div>;

    const inputFormClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-primary-500 focus:border-primary-500 outline-none";
    const selectFormClasses = "mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white";

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white uppercase tracking-tight">{isEditing ? `Modifier l'Achat` : "Créer un Achat"}</h1>
                    <button type="button" onClick={() => navigate('/purchases')} className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-bold">&larr; Retour</button>
                </div>
                {error && <div className="p-3 my-2 text-sm text-red-700 bg-red-100 rounded-md dark:bg-red-900/40 dark:text-red-300 border border-red-200 font-bold text-center">{error}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div><label className="block text-xs font-black uppercase text-gray-400">Date</label><input type="date" name="date" value={formState.date ? formState.date.split('T')[0] : ''} onChange={handleFormChange} required className={inputFormClasses}/></div>
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
                            <td className="px-4 py-3"><input type="number" value={item.cost} onChange={e => handleItemChange(index, 'cost', parseFloat(e.target.value))} className="w-24 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"/></td>
                            <td className="px-4 py-3"><input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value))} className="w-20 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"/></td>
                            <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">{formatCurrency(item.subtotal)}</td>
                            <td className="px-4 py-3"><button type="button" onClick={() => removeProduct(index)} className="text-red-600 hover:text-red-800"><DeleteIcon className="w-5 h-5"/></button></td>
                        </tr>))}
                    </tbody>
                </table></div>

                <div className="flex justify-end border-t pt-4 dark:border-gray-700">
                    <div className="w-full md:w-1/2 lg:w-1/3 space-y-2">
                        <div className="flex justify-between items-center"><span className="text-sm font-black uppercase text-gray-500">Sous-total:</span><span className="font-bold dark:text-white">{formatCurrency(calculateTotals(formState.items, 0))}</span></div>
                        <div className="flex justify-between items-center"><span className="text-sm font-black uppercase text-gray-500">Frais de livraison:</span><input type="number" name="shippingCost" value={formState.shippingCost} onChange={handleFormChange} className="w-24 px-2 py-1 text-right border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"/></div>
                        <div className="flex justify-between items-center pt-2 border-t dark:border-gray-700"><span className="text-lg font-black uppercase text-gray-800 dark:text-white">Total:</span><span className="text-xl font-bold text-primary-600">{formatCurrency(formState.grandTotal)}</span></div>
                        <div className="flex justify-between items-center pt-2"><span className="text-sm font-black uppercase text-gray-500">Statut Achat:</span><select name="purchaseStatus" value={formState.purchaseStatus} onChange={handleFormChange} className="ml-2 border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white"><option value="En attente">En attente</option><option value="Commandé">Commandé</option><option value="Reçu">Reçu</option></select></div>
                    </div>
                </div>

                <div className="mt-6"><label className="block text-xs font-black uppercase text-gray-400">Notes</label><textarea name="notes" value={formState.notes} onChange={handleFormChange} rows={3} className={inputFormClasses}></textarea></div>

                <div className="flex justify-end space-x-3 mt-6">
                    <button type="button" onClick={() => navigate('/purchases')} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 font-bold">Annuler</button>
                    <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 font-bold">{isSubmitting ? 'Enregistrement...' : 'Enregistrer'}</button>
                </div>
            </form>

            <Modal isOpen={isSupplierModalOpen} onClose={() => setIsSupplierModalOpen(false)} title="Nouveau Fournisseur">
                 <form onSubmit={handleAddSupplier} className="space-y-4">
                    <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Nom</label><input type="text" value={newSupplierState.name} onChange={e => setNewSupplierState(prev => ({...prev, name: e.target.value}))} required className={inputFormClasses} /></div>
                    <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Contact</label><input type="text" value={newSupplierState.contactPerson} onChange={e => setNewSupplierState(prev => ({...prev, contactPerson: e.target.value}))} className={inputFormClasses} /></div>
                    <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Téléphone</label><input type="text" value={newSupplierState.phone} onChange={e => setNewSupplierState(prev => ({...prev, phone: e.target.value}))} className={inputFormClasses} /></div>
                    <div className="flex justify-end space-x-2 mt-4">
                        <button type="button" onClick={() => setIsSupplierModalOpen(false)} className="px-3 py-2 border rounded hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Annuler</button>
                        <button type="submit" disabled={isAddingSupplier} className="px-3 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">{isAddingSupplier ? '...' : 'Créer'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default PurchaseFormPage;
