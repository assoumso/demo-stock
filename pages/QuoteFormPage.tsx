
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc } from 'firebase/firestore';
import { Quote, QuoteItem, Product, Customer, QuoteStatus, AppSettings, Sale } from '../types';
import { DeleteIcon, PlusIcon, SaveIcon, PrintIcon, CheckIcon, ArrowRightIcon, PurchaseIcon } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../utils/formatters';
import { useReactToPrint } from 'react-to-print';

// Placeholder for QuotePrint component
const QuotePrint = React.forwardRef<HTMLDivElement, { quote: Quote, customer?: Customer, settings?: any }>(({ quote, customer, settings }, ref) => {
    return (
        <div ref={ref} className="p-8 bg-white text-black print:text-black">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold uppercase tracking-widest text-gray-800">DEVIS</h1>
                    <p className="text-sm text-gray-500 mt-1">Référence: {quote.referenceNumber}</p>
                    <p className="text-sm text-gray-500">Date: {new Date(quote.date).toLocaleDateString()}</p>
                    <p className="text-sm text-gray-500">Valide jusqu'au: {new Date(quote.validUntil).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-bold">{settings?.companyName || 'Ridwane Supermarché'}</h2>
                    <p className="text-sm text-gray-600">{settings?.address || 'Adresse'}</p>
                    <p className="text-sm text-gray-600">{settings?.phone || 'Téléphone'}</p>
                </div>
            </div>

            <div className="mb-8 p-4 bg-gray-50 rounded-xl border">
                <h3 className="text-sm font-bold uppercase text-gray-500 mb-2">Client</h3>
                <p className="font-bold text-lg">{customer?.name || 'Client inconnu'}</p>
                <p className="text-gray-600">{customer?.phone}</p>
                <p className="text-gray-600">{customer?.address}</p>
            </div>

            <table className="w-full mb-8">
                <thead>
                    <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-3 font-bold uppercase text-xs">Article</th>
                        <th className="text-right py-3 font-bold uppercase text-xs">Qté</th>
                        <th className="text-right py-3 font-bold uppercase text-xs">Prix Unit.</th>
                        <th className="text-right py-3 font-bold uppercase text-xs">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {quote.items.map((item, index) => (
                        <tr key={index} className="border-b border-gray-100">
                            <td className="py-3 text-sm">{item.productId}</td> 
                            <td className="py-3 text-right text-sm">{item.quantity}</td>
                            <td className="py-3 text-right text-sm">{formatCurrency(item.price)}</td>
                            <td className="py-3 text-right font-bold text-sm">{formatCurrency(item.subtotal)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="flex justify-end">
                <div className="w-64 space-y-2">
                    <div className="flex justify-between text-xl font-black border-t-2 border-gray-800 pt-2">
                        <span>Total Global</span>
                        <span>{formatCurrency(quote.grandTotal)}</span>
                    </div>
                </div>
            </div>
            
            {quote.notes && (
                <div className="mt-8 pt-8 border-t border-gray-200">
                    <h4 className="font-bold text-sm uppercase mb-2">Notes</h4>
                    <p className="text-gray-600 text-sm">{quote.notes}</p>
                </div>
            )}
        </div>
    );
});


const QuoteFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isEditing = !!id;

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [settings, setSettings] = useState<AppSettings | null>(null);

    const [formState, setFormState] = useState<Omit<Quote, 'id'>>({
        referenceNumber: '',
        date: new Date().toISOString().split('T')[0],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 days
        customerId: '',
        items: [],
        grandTotal: 0,
        status: 'Brouillon',
        notes: '',
        createdByUserId: user?.uid || '',
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [productSearch, setProductSearch] = useState('');
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
    
    // Printing
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Devis_${formState.referenceNumber}`,
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [customersSnap, productsSnap, settingsSnap] = await Promise.all([
                    getDocs(collection(db, "customers")),
                    getDocs(collection(db, "products")),
                    getDoc(doc(db, "settings", "app-config"))
                ]);

                const custList = customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
                setCustomers(custList);
                setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
                
                const appSettings = settingsSnap.exists() ? settingsSnap.data() as AppSettings : null;
                setSettings(appSettings);

                if (isEditing) {
                    const docSnap = await getDoc(doc(db, "quotes", id!));
                    if (docSnap.exists()) {
                        const data = docSnap.data() as Omit<Quote, 'id'>;
                        setFormState(data);
                        const cust = custList.find(c => c.id === data.customerId);
                        if (cust) setCustomerSearchTerm(cust.name);
                    } else {
                        setError("Devis introuvable.");
                    }
                } else {
                    setFormState(prev => ({
                        ...prev,
                        referenceNumber: `DEV-${Date.now()}`,
                    }));
                }
            } catch (err) {
                console.error(err);
                setError("Erreur de chargement des données.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, isEditing]);

    const handleAddItem = (product: Product) => {
        setFormState(prev => {
            const existingItem = prev.items.find(i => i.productId === product.id);
            let newItems;
            if (existingItem) {
                newItems = prev.items.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price } : i);
            } else {
                newItems = [...prev.items, { productId: product.id, quantity: 1, price: product.price, subtotal: product.price }];
            }
            const grandTotal = newItems.reduce((sum, i) => sum + i.subtotal, 0);
            return { ...prev, items: newItems, grandTotal };
        });
        setProductSearch('');
    };

    const handleUpdateItem = (index: number, field: keyof QuoteItem, value: number) => {
        setFormState(prev => {
            const newItems = [...prev.items];
            const item = { ...newItems[index] };
            if (field === 'quantity') {
                item.quantity = value;
                item.subtotal = item.quantity * item.price;
            } else if (field === 'price') {
                item.price = value;
                item.subtotal = item.quantity * item.price;
            }
            newItems[index] = item;
            const grandTotal = newItems.reduce((sum, i) => sum + i.subtotal, 0);
            return { ...prev, items: newItems, grandTotal };
        });
    };

    const handleRemoveItem = (index: number) => {
        setFormState(prev => {
            const newItems = prev.items.filter((_, i) => i !== index);
            const grandTotal = newItems.reduce((sum, i) => sum + i.subtotal, 0);
            return { ...prev, items: newItems, grandTotal };
        });
    };

    const handleSave = async () => {
        if (!formState.customerId || formState.items.length === 0) {
            alert("Veuillez sélectionner un client et ajouter des articles.");
            return;
        }

        try {
            if (isEditing) {
                await updateDoc(doc(db, "quotes", id!), formState);
            } else {
                await addDoc(collection(db, "quotes"), formState);
            }
            navigate('/quotes');
        } catch (err) {
            console.error(err);
            alert("Erreur lors de l'enregistrement.");
        }
    };

    const handleConvertToSale = async () => {
        if (!id) return;
        if (!window.confirm("Voulez-vous convertir ce devis en vente ? Cela créera une nouvelle vente et marquera le devis comme 'Converti'.")) return;

        try {
            // Create Sale
            const saleData: Omit<Sale, 'id'> = {
                referenceNumber: `VNT-${Date.now()}`,
                customerId: formState.customerId,
                warehouseId: '', // Needs to be selected or default
                date: new Date().toISOString().split('T')[0],
                items: formState.items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price, subtotal: i.subtotal })),
                grandTotal: formState.grandTotal,
                paidAmount: 0,
                paymentStatus: 'En attente',
                saleStatus: 'En attente',
                notes: `Converti depuis le devis ${formState.referenceNumber}. ${formState.notes || ''}`
            };

            // Get default warehouse if possible
            const warehousesSnap = await getDocs(collection(db, "warehouses"));
            if (!warehousesSnap.empty) {
                saleData.warehouseId = warehousesSnap.docs[0].id;
            }

            const saleRef = await addDoc(collection(db, "sales"), saleData);

            // Update Quote status
            await updateDoc(doc(db, "quotes", id), {
                status: 'Converti',
                convertedSaleId: saleRef.id
            });

            alert("Devis converti avec succès !");
            navigate(`/sales/edit/${saleRef.id}`);

        } catch (err) {
            console.error(err);
            alert("Erreur lors de la conversion.");
        }
    };

    const handleConvertToPurchase = () => {
        if (!id) return;
        // We pass the current quote state to the purchase form
        navigate('/purchases/new', { 
            state: { 
                fromQuote: { id, ...formState } 
            } 
        });
    };

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        const lower = productSearch.toLowerCase();
        return products.filter(p => p.name.toLowerCase().includes(lower) || p.sku.toLowerCase().includes(lower)).slice(0, 10);
    }, [products, productSearch]);

    const filteredCustomers = useMemo(() => {
        if (!customerSearchTerm) return [];
        return customers.filter(c => c.name.toLowerCase().includes(customerSearchTerm.toLowerCase())).slice(0, 10);
    }, [customers, customerSearchTerm]);

    const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;

    if (loading) return <div className="p-10 text-center">Chargement...</div>;

    return (
        <div className="pb-10 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-black uppercase text-gray-900 dark:text-white">
                    {isEditing ? `Modifier Devis ${formState.referenceNumber}` : 'Nouveau Devis'}
                </h1>
                <div className="flex space-x-2">
                     {isEditing && (
                        <button onClick={handlePrint} className="px-4 py-2 bg-gray-800 text-white rounded-xl font-bold uppercase text-xs flex items-center">
                            <PrintIcon className="w-4 h-4 mr-2" /> Imprimer
                        </button>
                    )}
                    {isEditing && formState.status !== 'Converti' && (
                        <>
                        <button onClick={handleConvertToSale} className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold uppercase text-xs flex items-center hover:bg-purple-700">
                            <ArrowRightIcon className="w-4 h-4 mr-2" /> Convertir en Vente
                        </button>
                        <button onClick={handleConvertToPurchase} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold uppercase text-xs flex items-center hover:bg-blue-700">
                            <PurchaseIcon className="w-4 h-4 mr-2" /> Convertir en Achat
                        </button>
                        </>
                    )}
                    <button onClick={handleSave} className="px-6 py-2 bg-primary-600 text-white rounded-xl font-bold uppercase text-xs flex items-center hover:bg-primary-700 shadow-lg">
                        <SaveIcon className="w-4 h-4 mr-2" /> Enregistrer
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Items Section */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                        <div className="mb-4 relative">
                            <label className="block text-xs font-black uppercase text-gray-500 mb-1">Ajouter un article</label>
                            <input 
                                type="text" 
                                placeholder="Rechercher par nom ou SKU..." 
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl border-none focus:ring-2 focus:ring-primary-500"
                            />
                            {productSearch && filteredProducts.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 shadow-xl rounded-xl border dark:border-gray-700 max-h-60 overflow-auto">
                                    {filteredProducts.map(product => (
                                        <div 
                                            key={product.id} 
                                            onClick={() => handleAddItem(product)}
                                            className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-700 last:border-0"
                                        >
                                            <div className="font-bold text-gray-900 dark:text-white">{product.name}</div>
                                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                <span>SKU: {product.sku}</span>
                                                <span className="font-bold text-primary-600">{formatCurrency(product.price)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 uppercase text-[10px] font-black">
                                    <tr>
                                        <th className="px-4 py-3 text-left rounded-l-xl">Article</th>
                                        <th className="px-4 py-3 text-right w-24">Qté</th>
                                        <th className="px-4 py-3 text-right w-32">Prix</th>
                                        <th className="px-4 py-3 text-right w-32">Total</th>
                                        <th className="px-4 py-3 text-center w-10 rounded-r-xl"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {formState.items.map((item, index) => (
                                        <tr key={index}>
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white text-sm">{getProductName(item.productId)}</td>
                                            <td className="px-4 py-3">
                                                <input 
                                                    type="number" 
                                                    min="1" 
                                                    value={item.quantity} 
                                                    onChange={(e) => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                                    className="w-full text-right bg-transparent border-b border-gray-200 focus:border-primary-500 focus:outline-none font-bold"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                 <input 
                                                    type="number" 
                                                    min="0" 
                                                    value={item.price} 
                                                    onChange={(e) => handleUpdateItem(index, 'price', parseFloat(e.target.value) || 0)}
                                                    className="w-full text-right bg-transparent border-b border-gray-200 focus:border-primary-500 focus:outline-none"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-gray-900 dark:text-white">{formatCurrency(item.subtotal)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => handleRemoveItem(index)} className="text-red-400 hover:text-red-600">
                                                    <DeleteIcon className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {formState.items.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic text-sm">Aucun article ajouté</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Info Section */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                        <h3 className="font-black uppercase text-gray-900 dark:text-white mb-4 text-sm">Informations</h3>
                        
                        <div className="space-y-4">
                             <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-1">Référence</label>
                                <input 
                                    type="text" 
                                    value={formState.referenceNumber} 
                                    readOnly 
                                    className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl border-none text-gray-500 cursor-not-allowed font-mono"
                                />
                            </div>

                            <div className="relative">
                                <label className="block text-xs font-black uppercase text-gray-500 mb-1">Client</label>
                                <input 
                                    type="text" 
                                    placeholder="Rechercher un client..." 
                                    value={customerSearchTerm}
                                    onChange={(e) => {
                                        setCustomerSearchTerm(e.target.value);
                                        setShowCustomerSuggestions(true);
                                    }}
                                    onFocus={() => setShowCustomerSuggestions(true)}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl border-none focus:ring-2 focus:ring-primary-500 font-bold"
                                />
                                {showCustomerSuggestions && filteredCustomers.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 shadow-xl rounded-xl border dark:border-gray-700 max-h-40 overflow-auto">
                                        {filteredCustomers.map(c => (
                                            <div 
                                                key={c.id} 
                                                onClick={() => {
                                                    setFormState(prev => ({ ...prev, customerId: c.id }));
                                                    setCustomerSearchTerm(c.name);
                                                    setShowCustomerSuggestions(false);
                                                }}
                                                className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-700 last:border-0"
                                            >
                                                <div className="font-bold text-gray-900 dark:text-white">{c.name}</div>
                                                <div className="text-xs text-gray-500">{c.phone}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-1">Date</label>
                                    <input 
                                        type="date" 
                                        value={formState.date} 
                                        onChange={(e) => setFormState(prev => ({ ...prev, date: e.target.value }))}
                                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl border-none focus:ring-2 focus:ring-primary-500 font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-500 mb-1">Valide jusqu'au</label>
                                    <input 
                                        type="date" 
                                        value={formState.validUntil} 
                                        onChange={(e) => setFormState(prev => ({ ...prev, validUntil: e.target.value }))}
                                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl border-none focus:ring-2 focus:ring-primary-500 font-medium"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-1">Statut</label>
                                <select 
                                    value={formState.status} 
                                    onChange={(e) => setFormState(prev => ({ ...prev, status: e.target.value as QuoteStatus }))}
                                    disabled={formState.status === 'Converti'}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl border-none focus:ring-2 focus:ring-primary-500 font-bold"
                                >
                                    <option value="Brouillon">Brouillon</option>
                                    <option value="Envoyé">Envoyé</option>
                                    <option value="Accepté">Accepté</option>
                                    <option value="Refusé">Refusé</option>
                                    <option value="Converti" disabled>Converti</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-500 mb-1">Notes</label>
                                <textarea 
                                    value={formState.notes || ''} 
                                    onChange={(e) => setFormState(prev => ({ ...prev, notes: e.target.value }))}
                                    rows={3}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl border-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="bg-primary-900 text-white p-6 rounded-3xl shadow-lg">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-primary-200 text-sm font-medium">Total Hors Taxe</span>
                            <span className="font-bold">{formatCurrency(formState.grandTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-3xl font-black mt-4 pt-4 border-t border-primary-700">
                            <span>Total</span>
                            <span>{formatCurrency(formState.grandTotal)}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Hidden Print Component */}
            <div style={{ display: 'none' }}>
                <QuotePrint 
                    ref={printRef} 
                    quote={{ id: id || 'new', ...formState } as Quote} 
                    customer={customers.find(c => c.id === formState.customerId)}
                    settings={settings}
                />
            </div>
        </div>
    );
};

export default QuoteFormPage;
