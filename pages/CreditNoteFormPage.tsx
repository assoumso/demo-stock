
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, doc, getDocs, addDoc, runTransaction, query, orderBy, where } from 'firebase/firestore';
import { Customer, Product, Warehouse, CreditNote, CreditNoteItem, SalePayment } from '../types';
import { useAuth } from '../hooks/useAuth';
import { ArrowLeftIcon, PlusIcon, DeleteIcon, SearchIcon, WarningIcon } from '../constants';

const CreditNoteFormPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    
    // Form State
    const [customerId, setCustomerId] = useState('');
    const [type, setType] = useState<'financial' | 'return'>('return');
    const [warehouseId, setWarehouseId] = useState('');
    const [reason, setReason] = useState('');
    const [financialAmount, setFinancialAmount] = useState<number>(0);
    const [items, setItems] = useState<CreditNoteItem[]>([]);
    
    // Search
    const [customerSearch, setCustomerSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');

    useEffect(() => {
        const loadData = async () => {
            const [cSnap, pSnap, wSnap] = await Promise.all([
                getDocs(query(collection(db, "customers"), orderBy("name"))),
                getDocs(collection(db, "products")),
                getDocs(collection(db, "warehouses"))
            ]);
            setCustomers(cSnap.docs.map(d => ({id: d.id, ...d.data()} as Customer)));
            setProducts(pSnap.docs.map(d => ({id: d.id, ...d.data()} as Product)));
            const ws = wSnap.docs.map(d => ({id: d.id, ...d.data()} as Warehouse));
            setWarehouses(ws);
            if (ws.length > 0) setWarehouseId(ws.find(w => w.isMain)?.id || ws[0].id);
        };
        loadData();
    }, []);

    const filteredCustomers = useMemo(() => {
        if (!customerSearch) return [];
        return customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 5);
    }, [customerSearch, customers]);

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 5);
    }, [productSearch, products]);

    const addItem = (product: Product) => {
        setItems(prev => {
            const existing = prev.find(i => i.productId === product.id);
            if (existing) {
                return prev.map(i => i.productId === product.id ? {...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price} : i);
            }
            return [...prev, { productId: product.id, productName: product.name, quantity: 1, price: product.price, subtotal: product.price }];
        });
        setProductSearch('');
    };

    const updateItem = (index: number, field: keyof CreditNoteItem, value: number) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== index) return item;
            const newItem = { ...item, [field]: value };
            newItem.subtotal = newItem.quantity * newItem.price;
            return newItem;
        }));
    };

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const totalAmount = type === 'financial' ? financialAmount : items.reduce((sum, i) => sum + i.subtotal, 0);

    const handleSubmit = async () => {
        if (!customerId || !reason || totalAmount <= 0) return;
        if (type === 'return' && (!warehouseId || items.length === 0)) return;

        setLoading(true);
        try {
            await runTransaction(db, async (transaction) => {
                // 1. Generate Ref
                const ref = `AVOIR-${Date.now().toString().slice(-6)}`;
                
                // 2. Create Payment Record (for Statement)
                const paymentRef = doc(collection(db, "salePayments"));
                const paymentData: SalePayment = {
                    id: paymentRef.id,
                    saleId: `CREDIT_BALANCE_${customerId}`, // Special ID for generic credits
                    date: new Date().toISOString(),
                    amount: totalAmount,
                    method: 'Compte Avoir',
                    createdByUserId: user?.uid || '',
                    notes: `Note de Crédit: ${ref} - ${reason}`,
                    momoOperator: '',
                    momoNumber: ''
                };
                transaction.set(paymentRef, paymentData);

                // 3. Create Credit Note
                const newNoteRef = doc(collection(db, "creditNotes"));
                const newNote: CreditNote = {
                    id: newNoteRef.id,
                    referenceNumber: ref,
                    date: new Date().toISOString(),
                    customerId,
                    warehouseId: type === 'return' ? warehouseId : undefined,
                    items: type === 'return' ? items : [],
                    amount: totalAmount,
                    reason,
                    paymentId: paymentRef.id,
                    createdByUserId: user?.uid || ''
                };
                transaction.set(newNoteRef, newNote);

                // 4. Update Customer Balance
                const customerRef = doc(db, "customers", customerId);
                const customerSnap = await transaction.get(customerRef);
                if (!customerSnap.exists()) throw new Error("Client introuvable");
                const customerData = customerSnap.data() as Customer;
                const newBalance = (customerData.creditBalance || 0) + totalAmount;
                transaction.update(customerRef, { creditBalance: newBalance });

                // 5. Update Stock (if return)
                if (type === 'return') {
                    for (const item of items) {
                        const productRef = doc(db, "products", item.productId);
                        const productSnap = await transaction.get(productRef);
                        if (!productSnap.exists()) continue;
                        
                        const productData = productSnap.data() as Product;
                        const stockLevels = productData.stockLevels || [];
                        const existingLevelIndex = stockLevels.findIndex(sl => sl.warehouseId === warehouseId);
                        
                        if (existingLevelIndex >= 0) {
                            stockLevels[existingLevelIndex].quantity += item.quantity;
                        } else {
                            stockLevels.push({ warehouseId, quantity: item.quantity });
                        }
                        
                        transaction.update(productRef, { stockLevels });
                    }
                }
            });
            
            navigate('/credit-notes');
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la création de la note de crédit.");
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('fr-FR').format(val).replace(/\u202f/g, ' ') + ' FCFA';

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <button onClick={() => navigate('/credit-notes')} className="flex items-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-6 transition-colors">
                <ArrowLeftIcon className="w-5 h-5 mr-2" />
                Retour aux notes
            </button>

            <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-8">Nouvelle Note de Crédit</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    {/* Customer Selection */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Client Concerné</h2>
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={customerSearch}
                                onChange={e => { setCustomerSearch(e.target.value); if (customerId) setCustomerId(''); }}
                                placeholder="Rechercher un client..."
                                className={`w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl border-2 transition-all ${customerId ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-transparent focus:border-primary-500'}`}
                            />
                            {customerId && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 font-bold text-sm uppercase">Sélectionné</div>
                            )}
                        </div>
                        {customerSearch && !customerId && filteredCustomers.length > 0 && (
                            <ul className="mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-10">
                                {filteredCustomers.map(c => (
                                    <li 
                                        key={c.id}
                                        onClick={() => { setCustomerId(c.id); setCustomerSearch(c.name); }}
                                        className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-0 border-gray-100 dark:border-gray-700"
                                    >
                                        <div className="font-bold text-gray-900 dark:text-white">{c.name}</div>
                                        {c.businessName && <div className="text-xs text-gray-500">{c.businessName}</div>}
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
                                Retour de Marchandise
                            </button>
                            <button
                                onClick={() => setType('financial')}
                                className={`flex-1 py-4 rounded-xl border-2 font-bold transition-all ${type === 'financial' ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}
                            >
                                Crédit Financier
                            </button>
                        </div>
                    </div>

                    {/* Content based on type */}
                    {type === 'return' ? (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Entrepôt de retour</label>
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
                                                <span className="text-sm text-gray-500">{formatCurrency(p.price)}</span>
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
                                onChange={e => setFinancialAmount(parseFloat(e.target.value) || 0)}
                                className="w-full text-3xl font-black text-primary-600 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border-none focus:ring-2 focus:ring-primary-500"
                                placeholder="0"
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
                                placeholder="Ex: Retour produit défectueux..."
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
                            disabled={loading || !customerId || !reason || totalAmount <= 0}
                            className={`w-full py-4 rounded-xl font-black text-lg shadow-lg flex justify-center items-center transition-all ${
                                loading || !customerId || !reason || totalAmount <= 0
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

export default CreditNoteFormPage;
