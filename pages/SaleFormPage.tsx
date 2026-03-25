import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import { Sale, SaleItem, Product, Customer, Warehouse, PaymentStatus, PaymentMethod, AppSettings } from '../types';
import { DeleteIcon, PlusIcon, WarningIcon } from '../constants';
import { useData } from '../context/DataContext';
import { useAuth } from '../hooks/useAuth';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import QuickCustomerModal from '../components/QuickCustomerModal';
import { formatCurrency } from '../utils/formatters';

type FormSale = Omit<Sale, 'id'>;

const SaleFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { addToast } = useToast();
    const { customers, warehouses, products, settings, loading: dataLoading, refreshData } = useData();
    const isEditing = !!id;

    // Optimized lookups
    const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);

    // Barcode optimization
    const productBySku = useMemo(() => new Map(products.map(p => [p.sku.toLowerCase(), p])), [products]);
    const productByUpc = useMemo(() => new Map(products.filter(p => p.upc_ean).map(p => [p.upc_ean!, p])), [products]);

    // Debug logging
    useEffect(() => {
        console.log("SaleFormPage mounted", { id, user: user?.uid });
    }, [id, user]);

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
    const [customerCredit, setCustomerCredit] = useState(0);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Espèces');
    const [stockErrorModalOpen, setStockErrorModalOpen] = useState(false);
    const [stockErrorMessage, setStockErrorMessage] = useState('');
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

    // Gestion du scanner code-barres
    useBarcodeScanner({
        onScan: (barcode) => {
            console.log("Scanned barcode:", barcode);
            let product = productBySku.get(barcode.toLowerCase());
            
            if (!product) {
                product = productByUpc.get(barcode);
            }

            if (product) {
                addProductToSale(product);
            } else {
                console.warn("Produit non trouvé pour le code:", barcode);
            }
        },
        minLength: 3
    });

    useEffect(() => {
        const initForm = async () => {
            if (dataLoading) return; // Wait for global data

            if (location.state?.fromQuote) {
                const quoteData = location.state.fromQuote;
                setFormState({
                    referenceNumber: settings?.saleInvoicePrefix ? `${settings.saleInvoicePrefix}${Date.now()}` : `VNT-${Date.now()}`,
                    date: new Date().toISOString().split('T')[0],
                    customerId: quoteData.customerId || '',
                    warehouseId: formState.warehouseId || '', // Keep currently selected or default warehouse
                    items: quoteData.items.map((item: any) => ({
                        productId: item.productId,
                        productName: productMap.get(item.productId)?.name || 'Produit',
                        quantity: item.quantity,
                        price: item.price,
                        subtotal: item.subtotal
                    })),
                    grandTotal: quoteData.grandTotal,
                    paidAmount: 0,
                    paymentStatus: 'En attente',
                    saleStatus: 'En attente',
                    paymentDeadlineDays: 0,
                    notes: `Converti depuis le devis ${quoteData.referenceNumber}`,
                });
                
                const cust = customerMap.get(quoteData.customerId);
                if (cust) {
                    setCustomerSearchTerm(cust.name);
                    setSelectedCustomer(cust);
                    setCustomerCredit(cust.creditBalance || 0);
                }
                setLoading(false);
                return;
            }

            if (isEditing) {
                setLoading(true);
                try {
                    if (!id) return;
                    const { data, error: fetchError } = await supabase
                        .from('sales')
                        .select('*')
                        .eq('id', id)
                        .single();
                    
                    if (!fetchError && data) {
                        setFormState(data);
                        const cust = customerMap.get(data.customerId);
                        if (cust) {
                            setCustomerSearchTerm(cust.name);
                            setSelectedCustomer(cust);
                            setCustomerCredit(cust.creditBalance || 0);
                        }
                    } else {
                        setError("Vente non trouvée.");
                    }
                } catch (err) {
                    setError("Erreur de chargement de la vente.");
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            } else {
                // New sale initialization
                const prefix = settings?.saleInvoicePrefix || 'VNT-';
                if (!formState.referenceNumber) {
                    setFormState(prev => ({
                        ...prev,
                        referenceNumber: `${prefix}${Date.now()}`,
                        customerId: '',
                    }));
                }
                setLoading(false);
            }
        };

        initForm();
    }, [id, isEditing, dataLoading, customers, settings, customerMap, location.state]);

    useEffect(() => {
        const fetchBalance = async () => {
            if (!formState.customerId) {
                setCustomerBalance(0);
                setCustomerCredit(0);
                return;
            }
            try {
                const cust = customerMap.get(formState.customerId);
                setCustomerCredit(cust?.creditBalance || 0);
                let openingBalance = cust?.openingBalance || 0;

                const openingBalanceId = `OPENING_BALANCE_${formState.customerId}`;
                const { data: openPayments, error: opError } = await supabase
                    .from('sale_payments')
                    .select('amount')
                    .eq('saleId', openingBalanceId);
                
                const paidOpening = (openPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
                let totalUnpaid = Math.max(0, openingBalance - paidOpening);

                const { data: salesData, error: sError } = await supabase
                    .from('sales')
                    .select('id, grandTotal, paidAmount')
                    .eq('customerId', formState.customerId);
                
                if (salesData) {
                    salesData.forEach(sale => {
                        if (id && sale.id === id) return;
                        totalUnpaid += ((sale.grandTotal || 0) - (sale.paidAmount || 0));
                    });
                }

                setCustomerBalance(totalUnpaid);
            } catch (e) {
                console.warn("Erreur calcul solde client", e);
            }
        };
        fetchBalance();
    }, [formState.customerId, id, customers]);
    
    const userVisibleWarehouses = useMemo(() => {
        if (!user || !user.role) return [];
        if (user.role.name?.toLowerCase().includes('admin')) return warehouses;
        // Check for warehouseIds on user object (it might be camelCase or not depending on how it was fetched)
        const userWhIds = (user as any).warehouseIds || [];
        return warehouses.filter(wh => userWhIds.includes(wh.id));
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

        if (field === 'quantity') {
            const product = productMap.get(item.productId);
            if (product && product.type !== 'service') {
                const stockEntry = product.stockLevels?.find(sl => sl.warehouseId === formState.warehouseId);
                const availableStock = stockEntry?.quantity || 0;
                
                if (value > availableStock) {
                    setStockErrorMessage(`Stock insuffisant pour "${product.name}". Disponible: ${availableStock}, Demandé: ${value}`);
                    setStockErrorModalOpen(true);
                }
            }
        }

        item[field] = value;
        item.subtotal = item.quantity * item.price;
        setFormState(prev => ({ ...prev, items: newItems }));
    };

    const addProductToSale = (product: Product) => {
        setFormState(prev => {
            const existingItemIndex = prev.items.findIndex(item => item.productId === product.id);
            if (existingItemIndex >= 0) {
                const newItems = [...prev.items];
                const item = { ...newItems[existingItemIndex] };
                
                if (product.type !== 'service') {
                    const stockEntry = product.stockLevels?.find(sl => sl.warehouseId === formState.warehouseId);
                    const availableStock = stockEntry?.quantity || 0;
                    if (item.quantity + 1 > availableStock) {
                        setStockErrorMessage(`Stock insuffisant pour "${product.name}". Disponible: ${availableStock}`);
                        setStockErrorModalOpen(true);
                        return prev;
                    }
                }

                item.quantity += 1;
                item.subtotal = item.quantity * item.price;
                newItems[existingItemIndex] = item;
                return { ...prev, items: newItems };
            } else {
                if (product.type !== 'service') {
                    const stockEntry = product.stockLevels?.find(sl => sl.warehouseId === formState.warehouseId);
                    const availableStock = stockEntry?.quantity || 0;
                    if (availableStock < 1) {
                        setStockErrorMessage(`Stock insuffisant pour "${product.name}". Disponible: ${availableStock}`);
                        setStockErrorModalOpen(true);
                        return prev;
                    }
                }
                const newItem: SaleItem = { productId: product.id, productName: product.name, quantity: 1, price: product.price || 0, subtotal: product.price || 0 };
                return { ...prev, items: [...prev.items, newItem]};
            }
        });
        setProductSearch('');
    };

    const removeProduct = (index: number) => {
        setFormState(prev => ({...prev, items: prev.items.filter((_, i) => i !== index)}));
    };

    const generateSaleDetails = () => {
        const items = formState.items.map((item, index) => {
            const product = productMap.get(item.productId);
            return (
                <div key={index} className="flex justify-between text-xs py-1 border-b border-gray-300 dark:border-gray-600">
                    <span>{product?.name || 'Produit'}</span>
                    <span className="font-semibold">{item.quantity}x {formatCurrency(item.price)}</span>
                </div>
            );
        });
        return (
            <div className="space-y-2">
                <div className="font-semibold text-xs text-blue-700 dark:text-blue-400 mb-2">Articles de la vente:</div>
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
        if (formState.items.length === 0) { setError("Veuillez ajouter au moins un produit."); return; }
        if (!formState.customerId) { setError("Veuillez sélectionner un client."); return; }

        if (selectedCustomer?.isCreditLimited) {
            const newDebt = formState.grandTotal - formState.paidAmount;
            const projectedBalance = customerBalance + newDebt;
            if (projectedBalance > (selectedCustomer.creditLimit || 0)) {
                if (!window.confirm(`ALERTE LIMITE DE CRÉDIT : Le solde total du client (${formatCurrency(projectedBalance)}) va dépasser sa limite autorisée. Continuer ?`)) return;
            }
        }

        // Pré-validation du stock
        for (const item of formState.items) {
            const product = productMap.get(item.productId);
            if (product && product.type !== 'service') {
                const stockEntry = product.stockLevels?.find(sl => sl.warehouseId === formState.warehouseId);
                const availableStock = stockEntry?.quantity || 0;

                if (item.quantity > availableStock) {
                    setStockErrorMessage(`Stock insuffisant pour "${product.name}". Disponible: ${availableStock}, Demandé: ${item.quantity}`);
                    setStockErrorModalOpen(true);
                    return;
                }
            }
        }

        const now = new Date();
        const finalSaleData: any = { 
            ...formState,
            date: formState.date.includes('T') ? formState.date : `${formState.date}T${now.toISOString().split('T')[1]}`
        };
        if (formState.paymentDeadlineDays && formState.paymentDeadlineDays > 0) {
            const dueDate = new Date(formState.date);
            dueDate.setDate(dueDate.getDate() + Number(formState.paymentDeadlineDays));
            finalSaleData.paymentDueDate = dueDate.toISOString();
        } else {
            finalSaleData.paymentDueDate = null;
        }

        try {
            // --- PHASE 1 : GET ORIGINAL SALE IF EDITING ---
            let originalSale: Sale | null = null;
            if (isEditing && id) {
                const { data: fetchOrig } = await supabase.from('sales').select('*').eq('id', id).single();
                if (fetchOrig) originalSale = fetchOrig as Sale;
            }

            // --- PHASE 2 : SAVE SALE ---
            let saleId = id;
            if (isEditing && id) {
                await supabase.from('sales').update(finalSaleData).eq('id', id);
                addToast('Vente modifiée avec succès', 'success', {
                    label: 'Voir',
                    onClick: () => navigate('/sales')
                }, generateSaleDetails());
            } else {
                saleId = crypto.randomUUID();
                await supabase.from('sales').insert({ ...finalSaleData, id: saleId });
                addToast('Vente enregistrée avec succès', 'success', {
                    label: 'Voir',
                    onClick: () => navigate('/sales')
                }, generateSaleDetails());
            }

            // --- PHASE 3 : UPDATE STOCK ---
            const wasCompleted = originalSale?.saleStatus === 'Complétée';
            const isNowCompleted = finalSaleData.saleStatus === 'Complétée';

            const allProductIds = Array.from(new Set([
                ...finalSaleData.items.map((i: SaleItem) => i.productId),
                ...(originalSale?.items.map((i: any) => i.productId) || [])
            ]));

            const { data: currentProducts } = await supabase.from('products').select('*').in('id', allProductIds);

            for (const productId of allProductIds) {
                const productData = (currentProducts || []).find(p => p.id === productId);
                if (!productData || productData.type === 'service') continue;

                let stockLevels = [...(productData.stockLevels || [])];
                const newItem = finalSaleData.items.find((i: SaleItem) => i.productId === productId);
                const originalItem = originalSale?.items.find((i: any) => i.productId === productId);
                let stockChanged = false;

                // 1. Restore stock if editing and it was previously deducted
                if (isEditing && wasCompleted && originalItem) {
                    const whIdx = stockLevels.findIndex((sl: any) => sl.warehouseId === originalSale!.warehouseId);
                    if (whIdx > -1) {
                        stockLevels[whIdx].quantity += originalItem.quantity;
                        stockChanged = true;
                    }
                }

                // 2. Deduct stock if new item exists (regardless of sale status - immediate stock deduction)
                if (newItem && !isEditing) {
                    // For new sales, always deduct stock immediately
                    const whIdx = stockLevels.findIndex((sl: any) => sl.warehouseId === finalSaleData.warehouseId);
                    if (whIdx > -1) {
                        stockLevels[whIdx].quantity -= newItem.quantity;
                        stockChanged = true;
                        console.log(`Deducting stock for new sale - Product: ${productId}, Quantity: ${newItem.quantity}, New Level: ${stockLevels[whIdx].quantity}`);
                    }
                } else if (newItem && isEditing && isNowCompleted) {
                    // For editing, only deduct if now marked as completed
                    const whIdx = stockLevels.findIndex((sl: any) => sl.warehouseId === finalSaleData.warehouseId);
                    if (whIdx > -1 && !wasCompleted) {
                        // Only deduct if it wasn't completed before
                        stockLevels[whIdx].quantity -= newItem.quantity;
                        stockChanged = true;
                        console.log(`Deducting stock for edited completed sale - Product: ${productId}, Quantity: ${newItem.quantity}`);
                    }
                }

                if (stockChanged) {
                    await supabase.from('products').update({ stockLevels }).eq('id', productId);
                }
            }

            // --- PHASE 4 : HANDLE PAYMENTS ---
            if (!isEditing && finalSaleData.paidAmount > 0 && user) {
                let currentCredit = 0;
                const { data: custData } = await supabase.from('customers').select('creditBalance').eq('id', finalSaleData.customerId).single();
                if (custData) currentCredit = custData.creditBalance || 0;

                let paymentAmount = finalSaleData.paidAmount;
                let finalPaymentMethod = paymentMethod || 'Espèces';
                let usedCredit = 0;

                if (finalPaymentMethod === 'Compte Avoir' && currentCredit > 0) {
                     usedCredit = Math.min(paymentAmount, currentCredit);
                     currentCredit -= usedCredit;
                }

                if (paymentAmount > 0) {
                    const paymentId = crypto.randomUUID();
                    await supabase.from('sale_payments').insert({
                        id: paymentId,
                        saleId: saleId,
                        customerId: finalSaleData.customerId,
                        date: new Date().toISOString(),
                        amount: paymentAmount,
                        method: finalPaymentMethod,
                        createdByUserId: user.uid,
                        notes: 'Paiement initial à la vente'
                    });
                }

                if (usedCredit > 0) {
                    await supabase.from('customers').update({ creditBalance: currentCredit }).eq('id', finalSaleData.customerId);
                }

            } else if (isEditing && originalSale && finalSaleData.paidAmount !== originalSale.paidAmount && user && saleId) {
                const diff = finalSaleData.paidAmount - originalSale.paidAmount;
                if (diff !== 0) {
                    const paymentId = crypto.randomUUID();
                    await supabase.from('sale_payments').insert({
                        id: paymentId,
                        saleId: saleId,
                        customerId: finalSaleData.customerId,
                        date: new Date().toISOString(),
                        amount: diff,
                        method: paymentMethod || 'Espèces',
                        createdByUserId: user.uid,
                        notes: 'Ajustement manuel du montant payé sur facture'
                    });
                }
            }

            // --- PHASE 5 : UPDATE QUOTE STATUS IF CONVERTED ---
            if (location.state?.fromQuote?.id) {
                await supabase
                    .from('quotes')
                    .update({ 
                        status: 'Converti',
                        convertedSaleId: saleId 
                    })
                    .eq('id', location.state.fromQuote.id);
            }

            // Rafraîchir les produits
            console.log("🔄 Refreshing products after sale save...");
            await refreshData(['products', 'sales', 'customers']);
            console.log("✓ Products refreshed successfully");
            
            setTimeout(() => {
                navigate('/sales');
            }, 500);
            
        } catch (err: any) {
            console.error("Error saving sale:", err);
            const errorMessage = err.message || 'Une erreur est survenue';
            
            if (errorMessage.includes("Stock insuffisant")) {
                setStockErrorMessage(errorMessage);
                setStockErrorModalOpen(true);
            } else {
                setError(errorMessage);
                addToast(errorMessage, 'error');
            }
        }
    };

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 5);
    }, [productSearch, products]);
    
    const activeCustomers = useMemo(() => {
        return customers.filter(c => !c.isArchived);
    }, [customers]);

    const filteredCustomers = useMemo(() => {
        if (!customerSearchTerm) return [];
        return activeCustomers.filter(c => c.name.toLowerCase().includes(customerSearchTerm.toLowerCase())).slice(0, 5);
    }, [customerSearchTerm, activeCustomers]);

    const handleQuickAddCustomer = () => {
        setIsCustomerModalOpen(true);
    };

    const handleCustomerCreated = async (customer: Customer) => {
        // Mise à jour immédiate de l'interface (Optimistic UI)
        setFormState(prev => ({ ...prev, customerId: customer.id }));
        setCustomerSearchTerm(customer.name);
        setSelectedCustomer(customer);
        setIsCustomerModalOpen(false);

        // Rafraîchissement des données en arrière-plan
        await refreshData(['customers']);
    };

    const getProductName = (productId: string) => {
        try {
            return productMap.get(productId)?.name || 'Produit inconnu';
        } catch (e) { return 'Erreur produit'; }
    };

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
                    <div><label className="block text-xs font-black uppercase text-gray-400">Date</label><input type="date" name="date" value={formState.date ? formState.date.split('T')[0] : ''} onChange={handleFormChange} required className={inputFormClasses}/></div>
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
                        {formState.customerId && (
                            <div className="mt-1 text-right">
                                <span className={`text-xs font-black px-2 py-0.5 rounded ${customerBalance > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'}`}>
                                    Dette: {formatCurrency(customerBalance)}
                                </span>
                            </div>
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
                            <div className="text-right">
                                {p.type === 'service' ? (
                                    <span className="text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg">Service</span>
                                ) : (
                                    <div className="flex flex-col items-end">
                                        <span className={`text-sm font-black ${
                                            (formState.warehouseId
                                                ? (p.stockLevels?.find(sl => sl.warehouseId === formState.warehouseId)?.quantity || 0)
                                                : (p.stockLevels?.reduce((sum, sl) => sum + sl.quantity, 0) || 0)
                                            ) <= (p.minStockAlert || 0) ? 'text-red-600' : 'text-green-600'
                                        }`}>
                                            {formState.warehouseId
                                                ? (p.stockLevels?.find(sl => sl.warehouseId === formState.warehouseId)?.quantity || 0)
                                                : (p.stockLevels?.reduce((sum, sl) => sum + sl.quantity, 0) || 0)
                                            }
                                        </span>
                                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">En stock</span>
                                    </div>
                                )}
                            </div>
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
                    <tfoot className="border-t-2 border-gray-200 dark:border-gray-700">
                        <tr className="bg-gray-50 dark:bg-gray-700/50 font-black">
                            <td colSpan={2} className="px-4 py-3 text-right uppercase text-xs text-gray-500">Total</td>
                            <td className="px-4 py-3 text-left text-sm">{formState.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                            <td className="px-4 py-3 text-sm text-primary-600">{formatCurrency(formState.grandTotal)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table></div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t-2 border-dashed">
                    <div className="md:col-span-2 space-y-4">
                        <div><label className="block text-xs font-black uppercase tracking-widest text-gray-400">Statut de la vente</label><select name="saleStatus" value={formState.saleStatus} onChange={handleFormChange} className={inputFormClasses}><option>En attente</option><option>Complétée</option></select></div>
                        <div><label className="block text-xs font-black uppercase tracking-widest text-green-600">Montant versé (Acompte)</label><input type="number" name="paidAmount" value={formState.paidAmount || ''} onChange={handleFormChange} className={`${inputFormClasses} border-green-200 text-green-700 font-bold`}/></div>
                        {formState.paidAmount > 0 && (
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Méthode de paiement</label>
                                <select 
                                    value={paymentMethod} 
                                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                                    className={inputFormClasses}
                                    disabled={!formState.customerId}
                                >
                                    <option value="Espèces">Espèces</option>
                                    <option value="Mobile Money">Mobile Money</option>
                                    <option value="Virement bancaire">Virement bancaire</option>
                                    <option value="Autre">Autre</option>
                                    {customerCredit > 0 && (
                                        <option value="Compte Avoir">Compte Avoir (Dispo: {formatCurrency(customerCredit)})</option>
                                    )}
                                </select>
                                {paymentMethod === 'Compte Avoir' && formState.paidAmount > customerCredit && (
                                    <p className="text-xs text-red-600 mt-1">⚠️ Crédit insuffisant</p>
                                )}
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Note / Observation</label>
                            <textarea name="notes" rows={3} value={formState.notes || ''} onChange={handleFormChange} className={inputFormClasses} placeholder="Observations, détails supplémentaires..."></textarea>
                        </div>
                    </div>
                    <div className="space-y-4 bg-gray-50 dark:bg-gray-900/30 p-4 rounded-2xl border dark:border-gray-700">
                        {customerCredit > 0 && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-xl border border-yellow-200 dark:border-yellow-700">
                                <h3 className="text-xs font-black text-yellow-600 uppercase tracking-widest">Crédit Disponible</h3>
                                <p className="text-xl font-black text-yellow-600 mt-1">{formatCurrency(customerCredit)}</p>
                            </div>
                        )}
                        <div className="pt-2">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Total Général</h3>
                            <p className="text-3xl font-black text-primary-600 mt-1">{formatCurrency(formState.grandTotal)}</p>
                        </div>
                        {formState.paidAmount > 0 && (
                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-200 dark:border-green-700">
                                <h3 className="text-xs font-black text-green-600 uppercase tracking-widest">Montant Payé</h3>
                                <p className="text-xl font-black text-green-600 mt-1">{formatCurrency(formState.paidAmount)}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end space-x-3 pt-6">
                    <button type="button" onClick={() => navigate('/sales')} className="px-6 py-3 text-sm font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200">Annuler</button>
                    <button type="submit" className="px-10 py-3 text-sm text-white bg-primary-600 rounded-xl font-black shadow-lg hover:bg-primary-700 active:scale-95 transition-all">Enregistrer la vente</button>
                </div>
            </form>

            <Modal isOpen={stockErrorModalOpen} onClose={() => setStockErrorModalOpen(false)} title="Problème de Stock">
                <div className="flex flex-col items-center text-center p-4">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
                        <WarningIcon className="w-8 h-8 text-red-600" />
                    </div>
                    <h3 className="text-lg font-black text-gray-800 dark:text-white mb-2 uppercase">Stock Insuffisant</h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6 font-medium bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800/30">
                        {stockErrorMessage.replace("Error: ", "")}
                    </p>
                    <button 
                        onClick={() => setStockErrorModalOpen(false)} 
                        className="px-8 py-3 bg-red-600 text-white font-black uppercase tracking-wide rounded-xl shadow-lg hover:bg-red-700 active:scale-95 transition-all w-full"
                    >
                        Corriger la quantité
                    </button>
                </div>
            </Modal>
            
            <QuickCustomerModal 
                isOpen={isCustomerModalOpen} 
                onClose={() => setIsCustomerModalOpen(false)} 
                onSuccess={handleCustomerCreated}
            />
        </div>
    );
};

export default SaleFormPage;