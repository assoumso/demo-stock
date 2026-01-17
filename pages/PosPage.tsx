import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, runTransaction, addDoc, DocumentData, getDoc, DocumentReference, query, where } from 'firebase/firestore';
import { Product, Category, Customer, Warehouse, Sale, SaleItem, AppSettings, PaymentMethod } from '../types';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal';
import { SearchIcon, DeleteIcon, WarningIcon } from '../constants';
import { useReactToPrint } from 'react-to-print';
import PosReceipt from '../components/PosReceipt';


const PosPage: React.FC = () => {
    const { user } = useAuth();

    // Data from Firestore
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [settings, setSettings] = useState<Partial<AppSettings>>({});
    
    // UI State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // POS State
    const [cart, setCart] = useState<SaleItem[]>([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

    // Credit monitoring
    const [customerBalance, setCustomerBalance] = useState(0);

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [amountTendered, setAmountTendered] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Espèces');
    const [momoOperator, setMomoOperator] = useState('');
    const [momoNumber, setMomoNumber] = useState('');
    
    // Post-Sale State
    const [lastSale, setLastSale] = useState<Sale | null>(null);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const receiptRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [prodSnap, catSnap, custSnap, whSnap, settingsSnap] = await Promise.all([
                    getDocs(collection(db, "products")),
                    getDocs(collection(db, "categories")),
                    getDocs(collection(db, "customers")),
                    getDocs(collection(db, "warehouses")),
                    getDoc(doc(db, "settings", "app-config")),
                ]);
                
                setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
                setCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
                
                const customersData = custSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
                setCustomers(customersData);
                
                const warehousesData = whSnap.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse));
                setWarehouses(warehousesData);
                
                const appSettings: Partial<AppSettings> = settingsSnap.exists() ? settingsSnap.data() as AppSettings : {};
                setSettings(appSettings);
                
                const defaultCustomerId = appSettings.defaultPosCustomerId || 'walkin';
                setSelectedCustomerId(defaultCustomerId);

            } catch (err) {
                setError("Impossible de charger les données du POS.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchData();
        }
    }, [user]);

    useEffect(() => {
        const fetchBalance = async () => {
            if (!selectedCustomerId || selectedCustomerId === 'walkin') {
                setCustomerBalance(0);
                return;
            }
            try {
                const q = query(collection(db, "sales"), where("customerId", "==", selectedCustomerId));
                const snap = await getDocs(q);
                let totalUnpaid = 0;
                snap.docs.forEach(doc => {
                    const sale = doc.data() as Sale;
                    if (sale.paymentStatus !== 'Payé') {
                        totalUnpaid += (sale.grandTotal - (sale.paidAmount || 0));
                    }
                });
                setCustomerBalance(totalUnpaid);
            } catch (e) {
                console.warn("Erreur calcul solde client POS");
            }
        };
        fetchBalance();
    }, [selectedCustomerId]);

    const userVisibleWarehouses = useMemo(() => {
        if (!user || !user.role) return [];
        const userWarehouseIds = user.warehouseIds || [];
        if (user.role.name?.toLowerCase().includes('admin')) {
            return warehouses;
        }
        return warehouses.filter(wh => userWarehouseIds.includes(wh.id));
    }, [user, warehouses]);
    
    useEffect(() => {
        if (userVisibleWarehouses.length > 0) {
            const isSelectedWarehouseVisible = userVisibleWarehouses.some(wh => wh.id === selectedWarehouseId);
            if (!selectedWarehouseId || !isSelectedWarehouseVisible) {
                setSelectedWarehouseId(userVisibleWarehouses[0].id);
            }
        } else {
            setSelectedWarehouseId('');
        }
    }, [userVisibleWarehouses, selectedWarehouseId]);

    const getStock = (productId: string) => {
        const product = products.find(p => p.id === productId);
        if (product?.type === 'service') return Infinity;
        return product?.stockLevels?.find(sl => sl.warehouseId === selectedWarehouseId)?.quantity || 0;
    };

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const searchMatch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
            const categoryMatch = selectedCategory === 'all' || p.categoryId === selectedCategory;
            return searchMatch && categoryMatch;
        });
    }, [products, searchTerm, selectedCategory]);

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(item => item.productId !== productId));
    };

    const updateCartItem = (productId: string, quantity: number) => {
        const stock = getStock(productId);
        if (quantity > stock) {
            quantity = stock;
        }

        if (quantity <= 0) {
            removeFromCart(productId);
        } else {
            setCart(prev => prev.map(item => {
                if (item.productId === productId) {
                    return { ...item, quantity, subtotal: item.price * quantity };
                }
                return item;
            }));
        }
    };

    const updateCartItemPrice = (productId: string, newPrice: number) => {
        setCart(prev => prev.map(item => {
            if (item.productId === productId) {
                const price = newPrice >= 0 ? newPrice : 0;
                return { ...item, price, subtotal: price * item.quantity };
            }
            return item;
        }));
    };

    const addToCart = (product: Product) => {
        const existingItem = cart.find(item => item.productId === product.id);
        const stock = getStock(product.id);

        if (existingItem) {
            if (existingItem.quantity < stock) {
                updateCartItem(product.id, existingItem.quantity + 1);
            }
        } else {
            if (stock > 0) {
                const newItem: SaleItem = {
                    productId: product.id,
                    quantity: 1,
                    price: product.price,
                    subtotal: product.price,
                };
                setCart(prev => [...prev, newItem]);
            }
        }
    };

    const cartTotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.subtotal, 0);
    }, [cart]);
    
    const changeDue = useMemo(() => {
        const tendered = Number(amountTendered);
        if (!isNaN(tendered) && tendered >= cartTotal) {
            return tendered - cartTotal;
        }
        return 0;
    }, [amountTendered, cartTotal]);
    
    const handlePrint = useReactToPrint({
        contentRef: receiptRef,
    });

    const resetSale = async () => {
        setCart([]);
        setIsPaymentModalOpen(false);
        setAmountTendered(0);
        setPaymentMethod('Espèces');
        setMomoOperator('');
        setMomoNumber('');
        setLastSale(null);
        setIsReceiptModalOpen(false);
        try {
            const prodSnap = await getDocs(collection(db, "products"));
            setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
        } catch (err) {
            console.error("Failed to refetch products after sale:", err);
            setError("Impossible de mettre à jour les stocks.");
        }
    };
    
    const handleFinalizeSale = async () => {
        if (cart.length === 0 || !selectedWarehouseId || !selectedCustomerId || !user) {
            setError("Impossible de finaliser la vente. Données manquantes.");
            return;
        }

        if (paymentMethod === 'Mobile Money' && (!momoOperator || !momoNumber)) {
            setError("Opérateur et numéro requis pour Mobile Money.");
            return;
        }
        
        const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
        if (selectedCustomer?.isCreditLimited) {
            const projectedDebt = customerBalance + (cartTotal - amountTendered);
            if (projectedDebt > (selectedCustomer.creditLimit || 0)) {
                if (!window.confirm(`ALERTE LIMITE DE CRÉDIT : Ce client (${selectedCustomer.name}) va dépasser sa limite (${formatCurrency(selectedCustomer.creditLimit || 0)}) pour atteindre un crédit de ${formatCurrency(projectedDebt)}. Souhaitez-vous continuer ?`)) {
                    return;
                }
            }
        }

        setError(null);
        
        const saleData: any = {
            referenceNumber: `${settings.saleInvoicePrefix || 'POS-'}${Date.now()}`,
            date: new Date().toISOString(),
            customerId: selectedCustomerId,
            warehouseId: selectedWarehouseId,
            items: cart,
            grandTotal: cartTotal,
            paidAmount: amountTendered,
            paymentStatus: amountTendered >= cartTotal ? 'Payé' : amountTendered > 0 ? 'Partiel' : 'En attente',
            saleStatus: 'Complétée',
        };

        try {
            const newSaleRef = await runTransaction(db, async (transaction) => {
                const productRefs = cart.map(item => doc(db, 'products', item.productId));
                const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));
                const updates: { ref: DocumentReference<DocumentData>, data: { stockLevels: any[] } }[] = [];

                for (let i = 0; i < cart.length; i++) {
                    const item = cart[i];
                    const productDoc = productDocs[i];
                    if (!productDoc.exists()) throw new Error(`Produit "${item.productId}" non trouvé.`);

                    const productData = productDoc.data() as Product;
                    if (productData.type === 'service') continue;

                    const stockLevels = [...(productData.stockLevels || [])];
                    const whIndex = stockLevels.findIndex(sl => sl.warehouseId === selectedWarehouseId);
                    if (whIndex === -1 || stockLevels[whIndex].quantity < item.quantity) {
                        throw new Error(`Stock insuffisant pour ${productData.name}. Disponible: ${whIndex > -1 ? stockLevels[whIndex].quantity : 0}, Demandé: ${item.quantity}`);
                    }
                    stockLevels[whIndex].quantity -= item.quantity;
                    updates.push({ ref: productRefs[i], data: { stockLevels } });
                }

                for (const update of updates) transaction.update(update.ref, update.data);
                const saleRef = doc(collection(db, "sales"));
                transaction.set(saleRef, saleData as DocumentData);

                if (amountTendered > 0) {
                    const pData: any = {
                        saleId: saleRef.id,
                        date: new Date().toISOString(),
                        amount: amountTendered,
                        method: paymentMethod,
                        createdByUserId: user.uid
                    };
                    if (paymentMethod === 'Mobile Money') {
                        pData.momoOperator = momoOperator;
                        pData.momoNumber = momoNumber;
                    }
                    transaction.set(doc(collection(db, "salePayments")), pData);
                }

                return saleRef;
            });
            
            setLastSale({ id: newSaleRef.id, ...saleData });
            setIsPaymentModalOpen(false);
            setIsReceiptModalOpen(true);
        } catch (err: any) {
            setError(`Échec de la vente: ${err.message}`);
            setIsPaymentModalOpen(false);
        }
    };

    const formatCurrency = (v: number) => new Intl.NumberFormat('fr-FR').format(v).replace(/\u202f/g, ' ') + ' FCFA';
    
    if (loading) return <div className="p-12 text-center animate-pulse uppercase font-black text-gray-400">Chargement...</div>;

    const currentCustomerObj = customers.find(c => c.id === selectedCustomerId);
    const showCreditWarning = currentCustomerObj?.isCreditLimited && (customerBalance + cartTotal) > (currentCustomerObj.creditLimit || 0);

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-100 dark:bg-gray-900">
            {/* Main Content - Products */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="sticky top-0 bg-gray-100 dark:bg-gray-900 z-10 py-2 -mx-4 px-4">
                    {showCreditWarning && (
                        <div className="bg-red-500 text-white px-4 py-2 rounded-xl mb-4 text-xs font-bold uppercase tracking-widest flex items-center shadow-lg animate-pulse">
                            <WarningIcon className="w-4 h-4 mr-2" />
                            Alerte : Limite de crédit client atteinte ou dépassée
                        </div>
                    )}
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                        <div className="relative flex-grow">
                            <input
                                type="text"
                                placeholder="Rechercher des produits..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-full dark:bg-gray-800 dark:border-gray-700"
                            />
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        </div>
                        <select
                            value={selectedWarehouseId}
                            onChange={e => setSelectedWarehouseId(e.target.value)}
                            className="p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700 font-bold"
                        >
                            {userVisibleWarehouses.map(wh => (
                                <option key={wh.id} value={wh.id}>{wh.name}</option>
                            ))}
                        </select>
                    </div>
                     <div className="flex flex-wrap gap-2">
                        <button onClick={() => setSelectedCategory('all')} className={`px-3 py-1 text-sm font-bold rounded-full ${selectedCategory === 'all' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-700'}`}>Toutes</button>
                        {categories.map(cat => (
                             <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-3 py-1 text-sm font-bold rounded-full ${selectedCategory === cat.id ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-700'}`}>{cat.name}</button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mt-4">
                    {filteredProducts.map(product => {
                        const stock = getStock(product.id);
                        const inCartQty = cart.find(i => i.productId === product.id)?.quantity || 0;
                        const availableStock = stock - inCartQty;
                        
                        return (
                            <div key={product.id} onClick={() => (product.type === 'service' || availableStock > 0) && addToCart(product)} 
                                className={`relative border rounded-xl p-2 cursor-pointer text-center transition-all bg-white dark:bg-gray-800 ${(product.type !== 'service' && availableStock <= 0) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-2xl hover:-translate-y-1 hover:border-primary-500'}`}>
                                {product.imageUrl ? (
                                    <img src={product.imageUrl} alt={product.name} className="h-24 w-full object-cover rounded-lg"/>
                                ) : (
                                    <div className="h-24 w-full bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 text-[10px] font-black uppercase">Article</div>
                                )}
                                <p className="text-[11px] font-black mt-2 h-8 overflow-hidden uppercase tracking-tighter text-gray-700 dark:text-gray-300">{product.name}</p>
                                <p className="text-sm font-black text-primary-600">{product.price.toLocaleString('fr-FR')} <span className="text-[10px]">{settings.currencySymbol || 'FCFA'}</span></p>
                                {product.type === 'service' ? (
                                    <span className={`absolute top-1 right-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full text-white bg-blue-500`}>
                                        Svc
                                    </span>
                                ) : (
                                    <span className={`absolute top-1 right-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full text-white ${availableStock > (product.minStockAlert || 5) ? 'bg-green-500' : availableStock > 0 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                                        {stock}
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Cart Sidebar */}
            <div className="w-96 bg-white dark:bg-gray-800 border-l dark:border-gray-700 flex flex-col p-4 shadow-2xl">
                <h2 className="text-lg font-black uppercase tracking-widest text-gray-500 mb-4">Commande</h2>
                <div className="flex flex-col gap-2 mb-4">
                    <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 font-bold outline-none focus:ring-2 focus:ring-primary-500">
                        <option value="walkin">Client de passage</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {currentCustomerObj && selectedCustomerId !== 'walkin' && (
                        <div className="bg-gray-50 dark:bg-gray-900/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div className="flex justify-between text-[10px] font-black uppercase text-gray-400">
                                <span>Crédit Actuel</span>
                                <span className={customerBalance > 0 ? 'text-red-500' : ''}>{formatCurrency(customerBalance)}</span>
                            </div>
                            {currentCustomerObj.isCreditLimited && (
                                <div className="flex justify-between text-[10px] font-black uppercase text-orange-500 mt-1">
                                    <span>Limite Max</span>
                                    <span>{formatCurrency(currentCustomerObj.creditLimit || 0)}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="flex-grow overflow-y-auto -mx-4 px-4 divide-y divide-gray-200 dark:divide-gray-700">
                    {cart.length === 0 ? (
                        <div className="text-center py-12 opacity-30">
                            <p className="text-sm font-black uppercase tracking-widest">Panier Vide</p>
                        </div>
                    ) : (
                        cart.map(item => {
                            const product = products.find(p => p.id === item.productId);
                            if (!product) return null;
                            const stock = getStock(product.id);
                            return (
                                <div key={item.productId} className="flex items-center gap-2 py-4">
                                    <div className="flex-grow">
                                        <p className="text-xs font-black uppercase truncate text-gray-800 dark:text-gray-200" title={product.name}>{product.name}</p>
                                        <div className="flex items-center mt-1">
                                            <input
                                                type="number"
                                                value={item.price}
                                                onChange={(e) => updateCartItemPrice(item.productId, parseFloat(e.target.value) || 0)}
                                                className="w-20 text-[11px] p-1 border rounded bg-gray-50 dark:bg-gray-700 font-bold"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => updateCartItem(item.productId, item.quantity - 1)} className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 font-black">-</button>
                                        <input 
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => updateCartItem(item.productId, parseInt(e.target.value) || 0)}
                                            className="w-10 text-center bg-transparent font-black text-sm"
                                        />
                                        <button onClick={() => updateCartItem(item.productId, item.quantity + 1)} disabled={item.quantity >= stock} className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 font-black disabled:opacity-30">+</button>
                                    </div>
                                    <div className="w-20 text-right">
                                        <p className="font-black text-sm">{item.subtotal.toLocaleString('fr-FR')}</p>
                                    </div>
                                    <button onClick={() => removeFromCart(item.productId)} className="text-gray-300 hover:text-red-500 transition-colors">
                                        <DeleteIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )
                        })
                    )}
                </div>

                <div className="pt-6 border-t dark:border-gray-700 space-y-4">
                    <div className="flex justify-between items-baseline">
                        <span className="text-xs font-black uppercase text-gray-400">Total à payer</span>
                        <span className="text-3xl font-black text-primary-600">{cartTotal.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} <span className="text-sm">{settings.currencySymbol}</span></span>
                    </div>
                    <button 
                        onClick={() => { setIsPaymentModalOpen(true); setAmountTendered(cartTotal); }} 
                        disabled={cart.length === 0} 
                        className="w-full py-4 bg-primary-600 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-primary-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                        PAYER MAINTENANT
                    </button>
                </div>
            </div>

            {/* Payment Modal */}
            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Paiement & Finalisation">
                <div>
                    {error && <p className="text-red-500 bg-red-100 p-3 rounded-xl mb-6 font-bold text-center text-sm">{error}</p>}
                    <div className="text-center mb-8">
                        <p className="text-xs font-black uppercase text-gray-400 tracking-widest mb-1">Montant de la commande</p>
                        <p className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">{cartTotal.toLocaleString('fr-FR')} <span className="text-lg">{settings.currencySymbol}</span></p>
                    </div>
                    
                    <div className="space-y-4 mb-8">
                         <div>
                            <label className="block text-xs font-black uppercase text-gray-400 mb-2">Méthode de paiement</label>
                            <div className="grid grid-cols-2 gap-2">
                                {['Espèces', 'Mobile Money', 'Virement bancaire', 'Autre'].map(m => (
                                    <button key={m} type="button" onClick={() => { setPaymentMethod(m as PaymentMethod); if(m !== 'Mobile Money') { setMomoOperator(''); setMomoNumber(''); } }} className={`py-2 text-[10px] font-bold uppercase border-2 rounded-xl ${paymentMethod === m ? 'bg-primary-600 text-white border-primary-600' : 'bg-white dark:bg-gray-700 text-gray-500'}`}>{m}</button>
                                ))}
                            </div>
                        </div>

                        {paymentMethod === 'Mobile Money' && (
                            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-400 mb-1">Opérateur</label>
                                    <input type="text" value={momoOperator} onChange={e => setMomoOperator(e.target.value)} placeholder="MTN / Moov" className="w-full p-3 border rounded-xl dark:bg-gray-700 font-bold uppercase" />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-400 mb-1">Numéro</label>
                                    <input type="tel" value={momoNumber} onChange={e => setMomoNumber(e.target.value)} placeholder="00000000" className="w-full p-3 border rounded-xl dark:bg-gray-700 font-bold" />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-black uppercase text-gray-400 mb-1">Somme reçue</label>
                            <input type="number" value={amountTendered} onChange={e => setAmountTendered(Number(e.target.value))} className="w-full p-4 border rounded-2xl dark:bg-gray-700 text-2xl font-black outline-none focus:ring-4 focus:ring-primary-500/20" />
                        </div>
                        <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-gray-100 dark:border-gray-700">
                            <span className="text-xs font-black uppercase text-gray-500">Monnaie à rendre</span>
                            <span className="text-xl font-black text-green-600">{changeDue.toLocaleString('fr-FR')}</span>
                        </div>
                    </div>

                    <button onClick={handleFinalizeSale} className="w-full py-5 bg-green-600 text-white rounded-2xl font-black text-xl shadow-2xl hover:bg-green-700 transition-all active:scale-95">
                        CONFIRMER LA VENTE
                    </button>
                </div>
            </Modal>

            {/* Receipt Modal */}
             <Modal isOpen={isReceiptModalOpen} onClose={async () => { await resetSale(); }} title="Impression du Reçu">
                <div className="flex flex-col items-center w-full">
                    {lastSale && (
                        <div className="shadow-lg mb-6">
                            <PosReceipt
                                ref={receiptRef}
                                sale={lastSale}
                                customer={customers.find(c => c.id === lastSale.customerId) || null}
                                products={products}
                                companyInfo={settings}
                                warehouse={warehouses.find(w => w.id === lastSale.warehouseId) || null}
                            />
                        </div>
                    )}
                    <div className="w-full flex gap-3">
                        <button onClick={async () => { await resetSale(); }} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Suivant</button>
                        <button onClick={handlePrint} className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-primary-700 transition-colors">Imprimer</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PosPage;