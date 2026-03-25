import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { Product, Category, Customer, Warehouse, Sale, SaleItem, AppSettings, PaymentMethod } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../context/DataContext';
import Modal from '../components/Modal';
import { SearchIcon, DeleteIcon, WarningIcon, UserAddIcon, XIcon, WhatsappIcon } from '../constants';
import { useReactToPrint } from 'react-to-print';
import PosReceipt from '../components/PosReceipt';
import { formatCurrency } from '../utils/formatters';
import { shareInvoiceViaWhatsapp, normalizePhoneNumber } from '../utils/whatsappUtils';

// Definition du composant de carte produit
interface PosProductCardProps {
    product: Product;
    onAddToCart: (product: Product) => void;
    inCart: number;
    stock: number;
    currentSettings?: Partial<AppSettings>;
}

const PosProductCard = React.memo(({
    product,
    onAddToCart,
    inCart,
    stock,
    currentSettings
}: PosProductCardProps) => {
    const isOutOfStock = stock <= 0;
    const currency = currentSettings?.currencySymbol || 'FCFA';
    
    return (
        <div 
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 cursor-pointer transition-all hover:shadow-lg flex flex-col justify-between h-full ${
                isOutOfStock ? 'opacity-50' : 'hover:scale-105'
            }`}
            onClick={() => !isOutOfStock && onAddToCart(product)}
        >
            <div>
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                    {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover"/>
                    ) : (
                        <span className="text-2xl">📦</span>
                    )}
                </div>
                <h3 className="font-bold text-xs mb-1 text-gray-800 dark:text-white line-clamp-2 leading-tight min-h-[2.5em]">
                    {product.name}
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2 font-mono truncate">
                    {product.sku}
                </p>
            </div>
            <div className="flex justify-between items-end mt-auto">
                <span className="font-black text-sm text-primary-600">
                    {formatCurrency(product.price, currency)}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    isOutOfStock 
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : stock <= 10 
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                }`}>
                    {isOutOfStock ? 'Rupture' : `${stock}`}
                </span>
            </div>
            {inCart > 0 && (
                <div className="mt-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-[9px] px-2 py-0.5 rounded text-center font-bold">
                    Panier: {inCart}
                </div>
            )}
        </div>
    );
});

PosProductCard.displayName = 'PosProductCard';

const PosPage: React.FC = () => {
    const { user } = useAuth();
    const { 
        products, 
        categories, 
        customers, 
        warehouses, 
        settings, 
        loading: contextLoading,
        productsLoading,
        customersLoading,
        refreshData 
    } = useData();

    // UI State
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [isStockAlertOpen, setIsStockAlertOpen] = useState(false);
    const [stockAlertMessage, setStockAlertMessage] = useState('');

    // POS State
    const [cart, setCart] = useState<SaleItem[]>([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

    // Credit monitoring
    const [customerBalance, setCustomerBalance] = useState(0);
    const [customerCredit, setCustomerCredit] = useState(0);

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
    
    // Customer Search State
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    
    // Local product cache override for immediate UI updates
    const [localProductUpdates, setLocalProductUpdates] = useState<Map<string, Product>>(new Map());

    // Initialize default customer when settings or customers load
    useEffect(() => {
        if (settings && !selectedCustomerId) {
             const defaultCustomerId = settings.defaultPosCustomerId || 'walkin';
             setSelectedCustomerId(defaultCustomerId);
             const defaultCustomer = customers.find(c => c.id === defaultCustomerId);
             if (defaultCustomer) {
                 setCustomerSearchTerm(defaultCustomer.name);
             } else if (defaultCustomerId === 'walkin') {
                 setCustomerSearchTerm('Client de passage');
             }
        }
    }, [settings, selectedCustomerId, customers]);

    const activeCustomers = useMemo(() => {
        return customers.filter(c => !c.isArchived);
    }, [customers]);

    const filteredCustomers = useMemo(() => {
        if (!customerSearchTerm) return activeCustomers.slice(0, 10);
        return activeCustomers.filter(c => 
            c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) || 
            (c.phone && c.phone.includes(customerSearchTerm))
        ).slice(0, 10);
    }, [customerSearchTerm, activeCustomers]);

    const isLoading = contextLoading || productsLoading || customersLoading;
    const currentSettings: Partial<AppSettings> = settings || {};

    const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);

    useEffect(() => {
        const fetchBalance = async () => {
            if (!selectedCustomerId || selectedCustomerId === 'walkin') {
                setCustomerBalance(0);
                setCustomerCredit(0);
                return;
            }
            try {
                // Récupérer le crédit du client
                const customer = customerMap.get(selectedCustomerId);
                setCustomerCredit(customer?.creditBalance || 0);

                const { data: sales, error: fetchError } = await supabase
                    .from('sales')
                    .select('grandTotal, paidAmount')
                    .eq('customerId', selectedCustomerId)
                    .neq('paymentStatus', 'Payé');
                
                if (fetchError) throw fetchError;
                
                let totalUnpaid = 0;
                (sales || []).forEach((sale) => {
                    totalUnpaid += (sale.grandTotal - (sale.paidAmount || 0));
                });
                setCustomerBalance(totalUnpaid);
            } catch (e) {
                console.warn("Erreur calcul solde client POS", e);
            }
        };
        fetchBalance();
    }, [selectedCustomerId, customerMap]);

    const userVisibleWarehouses = useMemo(() => {
        if (!user || !user.role) return [];
        const userWarehouseIds = user.warehouseIds || [];
        if (user.role.name?.toLowerCase().includes('admin')) {
            return warehouses;
        }
        return warehouses.filter(wh => userWarehouseIds.includes(wh.id));
    }, [user, warehouses]);

    useEffect(() => {
        // Clean up cart if any products no longer exist
        const cleanedCart = cart.filter(item => {
            const product = productMap.get(item.productId);
            return product && !product.isArchived;
        });

        if (cleanedCart.length !== cart.length) {
            setCart(cleanedCart);
            if (cleanedCart.length === 0) {
                setError("Certains produits du panier ont été supprimés. Panier vidé.");
            }
        }
    }, [products]); // Re-run when products list changes
    
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
        const product = productMap.get(productId);
        if (product?.type === 'service') return Infinity;
        return product?.stockLevels?.find(sl => sl.warehouseId === selectedWarehouseId)?.quantity || 0;
    };

    const cartMap = useMemo(() => {
        const map = new Map<string, number>();
        cart.forEach(item => map.set(item.productId, item.quantity));
        return map;
    }, [cart]);

    const filteredProducts = useMemo(() => {
        const filtered = products.filter(p => {
            if (!p) return false;
            if (p.isArchived) return false; // Exclude archived products
            const pName = (p.name || '').toLowerCase();
            const pSku = (p.sku || '').toLowerCase();
            const searchLower = searchTerm.toLowerCase();

            const searchMatch = pName.includes(searchLower) || pSku.includes(searchLower);
            const categoryMatch = selectedCategory === 'all' || (p.categoryId === selectedCategory);

            return searchMatch && categoryMatch;
        });
        return filtered;
    }, [products, searchTerm, selectedCategory]);

    // PRÉ-CALCUL DES STOCKS ET PANIER - OPTIMISATION PERFORMANCE
    const productsStockMap = useMemo(() => {
        const map = new Map();
        filteredProducts.forEach(product => {
            // Check if there's a local optimistic update for this product
            const localProduct = localProductUpdates.get(product.id) || product;
            
            // Logique de calcul du stock intégrée pour éviter les dépendances externes instables
            let quantity = 0;
            if (localProduct && localProduct.stockLevels) {
                // Si une boutique est sélectionnée, on prend le stock de cette boutique
                if (selectedWarehouseId) {
                    const level = localProduct.stockLevels.find(sl => sl.warehouseId === selectedWarehouseId);
                    quantity = level ? level.quantity : 0;
                } else {
                    // Sinon on somme tous les stocks (ou on prend le stock global si disponible)
                    quantity = localProduct.stockLevels.reduce((sum, sl) => sum + (sl.quantity || 0), 0);
                }
            }
            map.set(product.id, quantity);
        });
        return map;
    }, [filteredProducts, selectedWarehouseId, localProductUpdates]);

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(item => item.productId !== productId));
    };

    const updateCartItem = (productId: string, quantity: number) => {
        const stock = getStock(productId);
        const product = productMap.get(productId);

        if (quantity > stock) {
            setStockAlertMessage(`Stock insuffisant pour "${product?.name || 'Produit'}". Disponible: ${stock}, Demandé: ${quantity}`);
            setIsStockAlertOpen(true);
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
            } else {
                setStockAlertMessage(`Stock insuffisant pour "${product.name}". Disponible: ${stock}`);
                setIsStockAlertOpen(true);
            }
        } else {
            if (stock > 0) {
                const newItem: SaleItem = {
                    productId: product.id,
                    productName: product.name,
                    quantity: 1,
                    price: product.price,
                    subtotal: product.price,
                };
                setCart(prev => [...prev, newItem]);
            } else {
                setStockAlertMessage(`Stock insuffisant pour "${product.name}". Disponible: ${stock}`);
                setIsStockAlertOpen(true);
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
            await refreshData(['products', 'sales', 'customers']);
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

        const selectedCustomer = activeCustomers.find(c => c.id === selectedCustomerId);
        if (selectedCustomer?.isCreditLimited) {
            const projectedDebt = customerBalance + (cartTotal - amountTendered);
            if (projectedDebt > (selectedCustomer.creditLimit || 0)) {
                if (!window.confirm(`ALERTE LIMITE DE CRÉDIT : Ce client (${selectedCustomer.name}) va dépasser sa limite (${formatCurrency(selectedCustomer.creditLimit || 0)}) pour atteindre un crédit de ${formatCurrency(projectedDebt)}. Souhaitez-vous continuer ?`)) {
                    return;
                }
            }
        }

        setError(null);

        const saleId = crypto.randomUUID();
        let saleData: any = {
            id: saleId,
            referenceNumber: `${currentSettings.saleInvoicePrefix || 'POS-'}${Date.now()}`,
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
            // 0. Validate products and fetch fresh data
            const productIds = cart.map(i => i.productId);
            const { data: freshProducts, error: fetchError } = await supabase
                .from('products')
                .select('*')
                .in('id', productIds);
            
            if (fetchError || !freshProducts) throw fetchError || new Error("Impossible de récupérer les produits");

            // Check for missing products and clean up cart
            const validCartItems = [];
            const missingProductIds = [];

            for (const item of cart) {
                const product = freshProducts.find(p => p.id === item.productId);
                if (!product) {
                    missingProductIds.push(item.productId);
                } else {
                    validCartItems.push(item);
                }
            }

            if (missingProductIds.length > 0) {
                setCart(validCartItems);
                setError("Certains produits ont été supprimés. Panier mis à jour.");
                return;
            }

            // 1. Process updates sequentially (Simulating a transaction)
            const updates = [];
            for (const item of validCartItems) {
                const product = freshProducts.find(p => p.id === item.productId);
                if (!product || product.type === 'service') continue;

                const stockLevels = [...(product.stockLevels || [])];
                const whIndex = stockLevels.findIndex((sl: any) => sl.warehouseId === selectedWarehouseId);
                
                if (whIndex === -1 || stockLevels[whIndex].quantity < item.quantity) {
                    throw new Error(`Stock insuffisant pour ${product.name}. Disponible: ${whIndex > -1 ? stockLevels[whIndex].quantity : 0}, Demandé: ${item.quantity}`);
                }
                
                stockLevels[whIndex].quantity -= item.quantity;
                updates.push({ id: product.id, stockLevels });
            }

            // A. Update Stock
            for (const update of updates) {
                const { error: updateError } = await supabase
                    .from('products')
                    .update({ stockLevels: update.stockLevels })
                    .eq('id', update.id);
                if (updateError) throw updateError;
            }

            // B. Create Sale
            const { error: saleError } = await supabase
                .from('sales')
                .insert(saleData);
            if (saleError) throw saleError;

            // C. Update Customer credit if paying with account balance
            if (amountTendered > 0 && paymentMethod === 'Compte Avoir' && selectedCustomerId && selectedCustomerId !== 'walkin') {
                const { data: custData, error: custFetchError } = await supabase
                    .from('customers')
                    .select('creditBalance')
                    .eq('id', selectedCustomerId)
                    .single();
                
                if (!custFetchError && custData) {
                    const availableCredit = custData.creditBalance || 0;
                    if (amountTendered <= availableCredit) {
                        const newCreditBalance = availableCredit - amountTendered;
                        await supabase
                            .from('customers')
                            .update({ creditBalance: newCreditBalance })
                            .eq('id', selectedCustomerId);
                    }
                }
            }

            // D. Create Payment record
            if (amountTendered > 0) {
                const paymentId = crypto.randomUUID();
                const pData: any = {
                    id: paymentId,
                    saleId: saleId,
                    date: new Date().toISOString(),
                    amount: amountTendered,
                    method: paymentMethod,
                    createdByUserId: user.uid,
                    momoOperator: paymentMethod === 'Mobile Money' ? momoOperator : null,
                    momoNumber: paymentMethod === 'Mobile Money' ? momoNumber : null
                };

                await supabase.from('sale_payments').insert(pData);
            }
            
            setLastSale(saleData);
            setIsPaymentModalOpen(false);
            setIsReceiptModalOpen(true);
            
            // Optimistic update
            const optimisticUpdates = new Map(localProductUpdates);
            for (const update of updates) {
                const currentProduct = products.find(p => p.id === update.id);
                if (currentProduct) {
                    optimisticUpdates.set(update.id, { ...currentProduct, stockLevels: update.stockLevels });
                }
            }
            setLocalProductUpdates(optimisticUpdates);
            
            setTimeout(async () => {
                await refreshData(['products', 'sales', 'customers']);
                setLocalProductUpdates(new Map());
            }, 1000);

        } catch (err: any) {
            setError(`Échec de la vente: ${err.message}`);
            setIsPaymentModalOpen(false);
        }
    };

    const handleShareReceipt = async () => {
        if (!lastSale || !settings) return;

        const customer = activeCustomers.find(c => c.id === lastSale.customerId);
        // Utiliser le téléphone du client ou demander
        let targetPhone = customer?.whatsapp || customer?.phone;
        
        if (!targetPhone) {
             const input = prompt("Entrez le numéro WhatsApp du client (ex: 229XXXXXXXX):");
             if (!input) return;
             targetPhone = input;
        }

        const cleanPhone = normalizePhoneNumber(targetPhone);
        const message = `*${settings.companyName || 'ETS COUL & FRERES'}*\n\nMerci de votre visite !\nVoici votre ticket *${lastSale.referenceNumber}*.\nMontant: ${formatCurrency(lastSale.grandTotal)}\n\nA bientôt !`;

        try {
            await shareInvoiceViaWhatsapp({
                elementId: 'pos-receipt-capture',
                filename: `Ticket_${lastSale.referenceNumber}.pdf`,
                phone: cleanPhone,
                message: message
            });
        } catch (error) {
            console.error("Erreur partage WhatsApp:", error);
            alert("Erreur lors du partage.");
        }
    };
    
    if (isLoading) return <div className="p-12 text-center animate-pulse uppercase font-black text-gray-400">Chargement...</div>;
    
    if (error) return <div className="p-12 text-center text-red-500 font-semibold">Erreur: {error}</div>;

    const currentCustomerObj = customerMap.get(selectedCustomerId);
    const showCreditWarning = currentCustomerObj?.isCreditLimited && (customerBalance + cartTotal) > (currentCustomerObj.creditLimit || 0);

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-100 dark:bg-gray-900">
            {/* Main Content - Products */}
            <div className="flex-1 flex flex-col h-full overflow-hidden p-4">
                <div className="flex-shrink-0 bg-gray-100 dark:bg-gray-900 z-10 py-2">
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
                                className="w-full pl-10 pr-12 py-2 border rounded-full dark:bg-gray-800 dark:border-gray-700"
                            />
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <XIcon className="w-4 h-4" />
                                </button>
                            )}
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
                     <div className="flex flex-wrap gap-2 pb-2">
                        <button onClick={() => setSelectedCategory('all')} className={`px-3 py-1 text-sm font-bold rounded-full ${selectedCategory === 'all' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-700'}`}>Toutes</button>
                        {categories.map(cat => (
                             <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-3 py-1 text-sm font-bold rounded-full ${selectedCategory === cat.id ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-700'}`}>{cat.name}</button>
                        ))}
                        <div className="ml-auto text-xs text-gray-500 font-mono">
                            {filteredProducts.length}/{products.length} produits
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="p-4">
                        {filteredProducts.length === 0 ? (
                            <div className="flex items-center justify-center h-64 text-gray-500">
                                <div className="text-center">
                                    {products.length === 0 ? (
                                        <>
                                            <p className="text-lg font-semibold">Aucun produit dans la base de données</p>
                                            <p className="text-sm">Veuillez ajouter des produits depuis la page "Produits"</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-lg font-semibold">Aucun produit trouvé</p>
                                            <p className="text-sm">Essayez de modifier vos filtres de recherche</p>
                                            <p className="text-xs mt-2 text-gray-400">Total produits: {products.length}</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {filteredProducts.map(product => (
                                    <PosProductCard
                                        key={product.id}
                                        product={product}
                                        onAddToCart={addToCart}
                                        inCart={cartMap.get(product.id) || 0}
                                        stock={productsStockMap.get(product.id) || 0}
                                        currentSettings={currentSettings}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Sidebar - Cart */}
            <div className="w-96 bg-white dark:bg-gray-800 shadow-xl flex flex-col border-l dark:border-gray-700">
                <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <h2 className="text-xl font-black uppercase tracking-widest text-gray-800 dark:text-white flex items-center gap-2">
                        <span>🛒</span> Panier
                    </h2>
                     <div className="mt-2 relative">
                        <label className="text-xs font-bold uppercase text-gray-500">Client</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={customerSearchTerm}
                                onChange={(e) => {
                                    setCustomerSearchTerm(e.target.value);
                                    setShowCustomerDropdown(true);
                                    if (e.target.value === '') {
                                        setSelectedCustomerId('');
                                    }
                                }}
                                onFocus={() => setShowCustomerDropdown(true)}
                                placeholder="Rechercher un client..."
                                className="w-full p-2 pr-8 border rounded mt-1 text-sm font-bold dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-primary-500"
                            />
                            {customerSearchTerm && (
                                <button 
                                    onClick={() => {
                                        setCustomerSearchTerm('');
                                        setSelectedCustomerId('');
                                        setShowCustomerDropdown(true);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <XIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        
                        {showCustomerDropdown && (
                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                <div 
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm font-bold border-b dark:border-gray-700"
                                    onClick={() => {
                                        setSelectedCustomerId('walkin');
                                        setCustomerSearchTerm('Client de passage');
                                        setShowCustomerDropdown(false);
                                    }}
                                >
                                    Client de passage
                                </div>
                                {filteredCustomers.map(c => (
                                    <div 
                                        key={c.id} 
                                        onClick={() => {
                                            setSelectedCustomerId(c.id);
                                            setCustomerSearchTerm(c.name);
                                            setShowCustomerDropdown(false);
                                        }}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm"
                                    >
                                        <div className="font-bold text-gray-900 dark:text-white">{c.name}</div>
                                        {c.businessName && <div className="text-xs text-gray-500">{c.businessName}</div>}
                                        {c.phone && <div className="text-xs text-gray-400">{c.phone}</div>}
                                    </div>
                                ))}
                                {filteredCustomers.length === 0 && (
                                    <div className="p-4 text-center text-gray-400 text-xs">Aucun client trouvé</div>
                                )}
                            </div>
                        )}
                        
                         {customerBalance > 0 && selectedCustomerId !== 'walkin' && (
                            <div className="text-xs text-red-500 font-bold mt-1 text-right">
                                Dette: {formatCurrency(customerBalance)}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.length === 0 ? (
                        <div className="text-center text-gray-400 mt-10">
                            <p className="text-4xl mb-2">🛍️</p>
                            <p className="text-sm font-bold uppercase">Panier vide</p>
                        </div>
                    ) : (
                        cart.map(item => {
                            const product = products.find(p => p.id === item.productId);
                            return (
                                <div key={item.productId} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                                    <div className="flex-1">
                                        <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{product?.name}</p>
                                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                            <span>{item.quantity} x </span>
                                            <input 
                                                type="number" 
                                                min="0"
                                                step="any"
                                                value={item.price} 
                                                onChange={(e) => updateCartItemPrice(item.productId, parseFloat(e.target.value))}
                                                className="w-20 p-1 border rounded text-xs font-bold bg-white dark:bg-gray-600 dark:text-white dark:border-gray-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-black text-gray-900 dark:text-white mr-2">{item.subtotal.toLocaleString()}</p>
                                        <button onClick={() => updateCartItem(item.productId, item.quantity - 1)} className="p-1 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500">-</button>
                                        <button onClick={() => updateCartItem(item.productId, item.quantity + 1)} className="p-1 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500">+</button>
                                        <button onClick={() => removeFromCart(item.productId)} className="p-1 text-red-500 hover:bg-red-50 rounded"><DeleteIcon className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-gray-500 font-bold uppercase text-sm">Total</span>
                        <span className="text-3xl font-black text-primary-600">{cartTotal.toLocaleString()} <span className="text-sm">{currentSettings.currencySymbol}</span></span>
                    </div>
                    <button
                        onClick={() => setIsPaymentModalOpen(true)}
                        disabled={cart.length === 0}
                        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black uppercase tracking-widest shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                    >
                        Payer Maintenant
                    </button>
                </div>
            </div>

            {/* Payment Modal */}
            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Paiement">
                <div className="space-y-6">
                    <div className="text-center bg-gray-100 dark:bg-gray-800 p-6 rounded-2xl">
                        <p className="text-gray-500 uppercase font-bold text-xs mb-2">Montant à payer</p>
                        <p className="text-4xl font-black text-gray-900 dark:text-white">{cartTotal.toLocaleString()} {settings.currencySymbol}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Mode de paiement</label>
                        <div className="grid grid-cols-2 gap-3">
                            {['Espèces', 'Mobile Money', 'Carte Bancaire', 'Virement', 'Chèque', 'Compte Avoir'].map((method) => (
                                <button
                                    key={method}
                                    onClick={() => setPaymentMethod(method as PaymentMethod)}
                                    className={`p-3 rounded-lg border text-sm font-bold transition-all ${paymentMethod === method ? 'bg-primary-600 text-white border-primary-600 shadow-md' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-primary-400'}`}
                                >
                                    {method}
                                </button>
                            ))}
                        </div>
                    </div>

                    {paymentMethod === 'Mobile Money' && (
                        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Opérateur</label>
                                <select value={momoOperator} onChange={e => setMomoOperator(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700">
                                    <option value="">Choisir...</option>
                                    <option value="MTN">MTN Mobile Money</option>
                                    <option value="MOOV">Moov Money</option>
                                    <option value="CELTII">Celtii Cash</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Numéro</label>
                                <input type="text" value={momoNumber} onChange={e => setMomoNumber(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700" placeholder="Ex: 01990000" />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Montant Reçu</label>
                        <input
                            type="number"
                            value={amountTendered}
                            onChange={(e) => setAmountTendered(Number(e.target.value))}
                            className="w-full p-4 text-2xl font-black text-center border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:ring-0 dark:bg-gray-800 dark:border-gray-600"
                            autoFocus
                        />
                    </div>

                    {amountTendered >= cartTotal && (
                        <div className="bg-green-100 text-green-800 p-4 rounded-xl text-center">
                            <p className="text-xs font-bold uppercase">Monnaie à rendre</p>
                            <p className="text-2xl font-black">{changeDue.toLocaleString()} {settings.currencySymbol}</p>
                        </div>
                    )}

                    <button
                        onClick={handleFinalizeSale}
                        className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-black uppercase tracking-widest shadow-lg transition-transform active:scale-95"
                    >
                        Valider la vente
                    </button>
                </div>
            </Modal>

            {/* Receipt Modal */}
             <Modal isOpen={isReceiptModalOpen} onClose={resetSale} title="Ticket de Caisse">
                <div className="flex flex-col h-[80vh]">
                    <div className="flex-1 overflow-auto bg-gray-100 p-4 rounded border mb-4">
                        <PosReceipt 
                            id="pos-receipt-capture"
                            ref={receiptRef} 
                            sale={lastSale} 
                            companyInfo={settings} 
                            customer={customers.find(c => c.id === lastSale?.customerId)}
                            products={products}
                            warehouse={warehouses.find(w => w.id === selectedWarehouseId)}
                        />
                    </div>
                    <div className="flex gap-4">
                        <button onClick={handleShareReceipt} className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold uppercase flex items-center justify-center gap-2">
                            <WhatsappIcon className="w-5 h-5" />
                            WhatsApp
                        </button>
                        <button onClick={handlePrint} className="flex-1 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-bold uppercase">
                            Imprimer
                        </button>
                        <button onClick={resetSale} className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold uppercase">
                            Nouvelle
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Stock Alert Modal */}
            <Modal isOpen={isStockAlertOpen} onClose={() => setIsStockAlertOpen(false)} title="Alerte Stock">
                <div className="p-6 text-center">
                    <WarningIcon className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <p className="text-lg font-bold text-gray-800 dark:text-white mb-2">Attention !</p>
                    <p className="text-gray-600 dark:text-gray-300">{stockAlertMessage}</p>
                    <button
                        onClick={() => setIsStockAlertOpen(false)}
                        className="mt-6 px-6 py-2 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-colors"
                    >
                        Compris
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default PosPage;
