
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { collection, doc, getDocs, runTransaction, query, orderBy } from 'firebase/firestore';
import { Supplier, Product, Warehouse, SupplierCreditNote, CreditNoteItem, Payment } from '../types';
import { useAuth } from '../hooks/useAuth';
import { ArrowLeftIcon, SearchIcon, DeleteIcon } from '../constants';
import { formatCurrency } from '../utils/formatters';

const SupplierCreditNoteFormPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    
    // Form State
    const [supplierId, setSupplierId] = useState('');
    const [type, setType] = useState<'financial' | 'return'>('return');
    const [warehouseId, setWarehouseId] = useState('');
    const [reason, setReason] = useState('');
    const [financialAmount, setFinancialAmount] = useState<number>(0);
    const [items, setItems] = useState<CreditNoteItem[]>([]);
    
    // Search
    const [supplierSearch, setSupplierSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [sSnap, pSnap, wSnap] = await Promise.all([
                    getDocs(query(collection(db, "suppliers"), orderBy("name"))),
                    getDocs(collection(db, "products")),
                    getDocs(collection(db, "warehouses"))
                ]);
                
                setSuppliers(sSnap.docs.map(d => ({id: d.id, ...d.data()} as Supplier)));
                setProducts(pSnap.docs.map(d => ({id: d.id, ...d.data()} as Product)));
                const ws = wSnap.docs.map(d => ({id: d.id, ...d.data()} as Warehouse));
                setWarehouses(ws);
                if (ws.length > 0) setWarehouseId(ws.find(w => w.isMain)?.id || ws[0].id);
            } catch (error) {
                console.error('Erreur lors du chargement des données:', error);
                alert('Erreur lors du chargement des données. Veuillez actualiser la page.');
            }
        };
        loadData();
    }, []);

    const filteredSuppliers = useMemo(() => {
        if (!supplierSearch) return [];
        return suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).slice(0, 5);
    }, [supplierSearch, suppliers]);

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 5);
    }, [productSearch, products]);

    const addItem = (product: Product) => {
        setItems(prev => {
            const existing = prev.find(i => i.productId === product.id);
            if (existing) {
                const newQuantity = existing.quantity + 1;
                return prev.map(i => i.productId === product.id ? {...i, quantity: newQuantity, subtotal: newQuantity * i.price} : i);
            }
            // For suppliers, we use 'cost' as default price, but allow editing
            return [...prev, { 
                productId: product.id, 
                productName: product.name, 
                quantity: 1, 
                price: product.cost || 0, 
                subtotal: product.cost || 0 
            }];
        });
        setProductSearch('');
    };

    const updateItem = (index: number, field: keyof CreditNoteItem, value: number) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== index) return item;
            const newItem = { ...item, [field]: value };
            newItem.subtotal = Math.max(0, newItem.quantity) * Math.max(0, newItem.price);
            return newItem;
        }));
    };

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const totalAmount = React.useMemo(() => {
        if (type === 'financial') {
            return Math.max(0, financialAmount || 0);
        } else {
            return items.reduce((sum, i) => {
                const subtotal = (i.quantity || 0) * (i.price || 0);
                return sum + Math.max(0, subtotal);
            }, 0);
        }
    }, [type, financialAmount, items]);

    const handleSubmit = async () => {
        // Validation des données
        if (!supplierId) {
            alert("Veuillez sélectionner un fournisseur");
            return;
        }
        if (!reason || reason.trim() === '') {
            alert("Veuillez entrer un motif");
            return;
        }
        if (totalAmount <= 0) {
            alert("Le montant doit être supérieur à 0");
            return;
        }
        if (type === 'return' && (!warehouseId || warehouseId === '')) {
            alert("Veuillez sélectionner un entrepôt");
            return;
        }
        if (type === 'return' && items.length === 0) {
            alert("Veuillez ajouter au moins un produit");
            return;
        }

        setLoading(true);
        try {
            await runTransaction(db, async (transaction) => {
                // PHASE 1: READS (Must be first)
                // Read Supplier
                const supplierRef = doc(db, "suppliers", supplierId);
                const supplierSnap = await transaction.get(supplierRef);
                if (!supplierSnap.exists()) {
                    throw new Error("Fournisseur introuvable dans la base de données");
                }
                const supplierData = supplierSnap.data() as Supplier;

                // Read Products (if return) - Prepare updates
                const productUpdates: { ref: any, data: any }[] = [];
                if (type === 'return' && warehouseId) {
                    for (const item of items) {
                        if (!item.productId || !item.productId.trim() || item.quantity <= 0) {
                            throw new Error(`Produit invalide: ${item.productName || 'Nom inconnu'}`);
                        }
                        
                        const productRef = doc(db, "products", item.productId);
                        const productSnap = await transaction.get(productRef);
                        if (!productSnap.exists()) {
                            throw new Error(`Produit ${item.productName || item.productId} introuvable`);
                        }
                        
                        const productData = productSnap.data() as Product;
                        if (!productData.stockLevels || !Array.isArray(productData.stockLevels)) {
                            // If stockLevels is missing, assume 0 stock
                            throw new Error(`Stock insuffisant pour ${item.productName} (Pas de stock défini)`);
                        }
                        
                        const stockLevels = [...productData.stockLevels];
                        const existingLevelIndex = stockLevels.findIndex(sl => sl && sl.warehouseId === warehouseId);
                        
                        if (existingLevelIndex === -1 || (stockLevels[existingLevelIndex].quantity || 0) < item.quantity) {
                             const current = existingLevelIndex >= 0 ? stockLevels[existingLevelIndex].quantity : 0;
                             throw new Error(`Stock insuffisant pour ${item.productName} (Disponible: ${current}, Demandé: ${item.quantity})`);
                        }

                        // Deduct Stock (Return to Supplier = Stock OUT)
                        stockLevels[existingLevelIndex] = {
                            ...stockLevels[existingLevelIndex],
                            quantity: stockLevels[existingLevelIndex].quantity - item.quantity
                        };
                        
                        productUpdates.push({ ref: productRef, data: { stockLevels } });
                    }
                }

                // PHASE 2: WRITES
                // Generate Ref
                const ref = `AVOIR-FOURN-${Date.now().toString().slice(-6)}`;
                
                // Create Payment Record (for Statement)
                // This mimics "We paid the supplier" or "Supplier gave us credit"
                // It shows up as a DEBIT in the supplier account (reducing debt).
                const paymentRef = doc(collection(db, "purchasePayments"));
                const paymentData: Payment = {
                    id: paymentRef.id,
                    purchaseId: `CREDIT_BALANCE_${supplierId}`,
                    supplierId,
                    date: new Date().toISOString(),
                    amount: totalAmount,
                    method: 'Compte Avoir',
                    createdByUserId: user?.uid || '',
                    notes: `Avoir Fournisseur: ${ref} - ${reason || ''}`,
                    momoOperator: '',
                    momoNumber: ''
                };
                transaction.set(paymentRef, paymentData);

                // Create Credit Note
                const newNoteRef = doc(collection(db, "supplierCreditNotes"));
                // Sanitize items to ensure no undefined values
                const sanitizedItems = (type === 'return' ? items : []).map(i => ({
                    productId: i.productId || '',
                    productName: i.productName || 'Produit Inconnu',
                    quantity: i.quantity || 0,
                    price: i.price || 0,
                    subtotal: i.subtotal || 0
                }));

                const newNote: SupplierCreditNote = {
                    id: newNoteRef.id,
                    referenceNumber: ref,
                    date: new Date().toISOString(),
                    supplierId,
                    warehouseId: type === 'return' ? (warehouseId || '') : '',
                    items: sanitizedItems,
                    amount: totalAmount,
                    reason: reason || '',
                    paymentId: paymentRef.id,
                    createdByUserId: user?.uid || ''
                };
                transaction.set(newNoteRef, newNote);

                // Update Supplier Credit Balance
                // Supplier Credit Balance = Amount supplier owes us.
                // We are ADDING to this balance.
                const currentBalance = Number(supplierData.creditBalance || 0);
                const newBalance = currentBalance + Number(totalAmount);
                
                transaction.update(supplierRef, { creditBalance: newBalance });

                // Update Stock
                for (const update of productUpdates) {
                    transaction.update(update.ref, update.data);
                }
            });
            
            if (navigate) {
                navigate('/supplier-credit-notes');
            } else {
                window.location.href = '/supplier-credit-notes';
            }
        } catch (err) {
            console.error('Erreur détaillée lors de la création de l\'avoir:', err);
            let errorMessage = 'Erreur inconnue lors de la création de l\'avoir';
            
            if (err instanceof Error) {
                errorMessage = err.message;
            } else if (typeof err === 'string') {
                errorMessage = err;
            }
            
            alert(`Erreur: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="p-6 max-w-5xl mx-auto">
            <button onClick={() => navigate('/supplier-credit-notes')} className="flex items-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-6 transition-colors">
                <ArrowLeftIcon className="w-5 h-5 mr-2" />
                Retour aux avoirs
            </button>

            <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-8">Nouvel Avoir Fournisseur</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    {/* Supplier Selection */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Fournisseur Concerné</h2>
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={supplierSearch}
                                onChange={e => { setSupplierSearch(e.target.value); if (supplierId) setSupplierId(''); }}
                                placeholder="Rechercher un fournisseur..."
                                className={`w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl border-2 transition-all ${supplierId ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-transparent focus:border-primary-500'}`}
                            />
                            {supplierId && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 font-bold text-sm uppercase">Sélectionné</div>
                            )}
                        </div>
                        {supplierSearch && !supplierId && filteredSuppliers.length > 0 && (
                            <ul className="mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-10">
                                {filteredSuppliers.map(s => (
                                    <li 
                                        key={s.id}
                                        onClick={() => { setSupplierId(s.id); setSupplierSearch(s.name); }}
                                        className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-0 border-gray-100 dark:border-gray-700"
                                    >
                                        <div className="font-bold text-gray-900 dark:text-white">{s.name}</div>
                                        {s.businessName && <div className="text-xs text-gray-500">{s.businessName}</div>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Type Selection */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Type d'Avoir</h2>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setType('return')}
                                className={`flex-1 py-4 rounded-xl border-2 font-bold transition-all ${type === 'return' ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}
                            >
                                Retour de Marchandise (Stock Sortant)
                            </button>
                            <button
                                onClick={() => setType('financial')}
                                className={`flex-1 py-4 rounded-xl border-2 font-bold transition-all ${type === 'financial' ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}
                            >
                                Avoir Financier
                            </button>
                        </div>
                    </div>

                    {/* Content based on type */}
                    {type === 'return' ? (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Entrepôt de sortie</label>
                                <select 
                                    value={warehouseId} 
                                    onChange={e => setWarehouseId(e.target.value)}
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border-none focus:ring-2 focus:ring-primary-500"
                                >
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>

                            <div className="mb-6 relative">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Ajouter des produits</label>
                                <div className="relative">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={productSearch}
                                        onChange={e => setProductSearch(e.target.value)}
                                        placeholder="Rechercher un produit..."
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl border-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                                {productSearch && filteredProducts.length > 0 && (
                                    <ul className="absolute z-20 w-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                                        {filteredProducts.map(p => (
                                            <li 
                                                key={p.id}
                                                onClick={() => addItem(p)}
                                                className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-0 border-gray-100 dark:border-gray-700 flex justify-between items-center"
                                            >
                                                <span className="font-bold">{p.name}</span>
                                                <span className="text-sm text-gray-500">{formatCurrency(p.cost)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {items.length > 0 && (
                                <div className="space-y-4">
                                    {items.map((item, idx) => {
                                        const product = products.find(p => p.id === item.productId);
                                        return (
                                            <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                                <div className="flex-1">
                                                    <div className="font-bold text-gray-900 dark:text-white">{product?.name}</div>
                                                    <div className="text-xs text-gray-500">{formatCurrency(item.price)} / unité</div>
                                                </div>
                                                <div className="w-24">
                                                    <input 
                                                        type="number" 
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                                                        className="w-full p-2 rounded-lg text-center font-bold"
                                                    />
                                                </div>
                                                <div className="w-32 text-right font-black text-gray-900 dark:text-white">
                                                    {formatCurrency(item.subtotal)}
                                                </div>
                                                <button onClick={() => removeItem(idx)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                                                    <DeleteIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Montant du Crédit</label>
                            <input 
                                type="number"
                                value={financialAmount}
                                onChange={e => {
                                    const value = parseFloat(e.target.value);
                                    setFinancialAmount(isNaN(value) || value < 0 ? 0 : value);
                                }}
                                className="w-full text-3xl font-black text-primary-600 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border-none focus:ring-2 focus:ring-primary-500"
                                placeholder="0"
                                min="0"
                                step="0.01"
                            />
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 sticky top-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Résumé</h2>
                        
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Motif / Notes</label>
                            <textarea
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border-none focus:ring-2 focus:ring-primary-500 h-32 resize-none"
                                placeholder="Ex: Retour produit défectueux, Erreur facturation..."
                            ></textarea>
                        </div>

                        <div className="py-4 border-t-2 border-dashed border-gray-200 dark:border-gray-600 mb-6">
                            <div className="flex justify-between items-end">
                                <span className="text-gray-500 font-bold uppercase tracking-widest text-xs">Total Avoir</span>
                                <span className="text-3xl font-black text-primary-600">{formatCurrency(totalAmount)}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={loading || !supplierId || !reason || totalAmount <= 0}
                            className={`w-full py-4 rounded-xl font-black text-lg shadow-lg flex justify-center items-center transition-all ${
                                loading || !supplierId || !reason || totalAmount <= 0
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-primary-600 text-white hover:bg-primary-700 hover:scale-[1.02]'
                            }`}
                        >
                            {loading && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"/>}
                            Valider l'Avoir
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupplierCreditNoteFormPage;
