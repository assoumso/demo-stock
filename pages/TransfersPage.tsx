import React, { useState, useEffect, useMemo, FormEvent, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, runTransaction, DocumentData, query, orderBy, limit, getDoc } from 'firebase/firestore';
import { WarehouseTransfer, Product, Warehouse, WarehouseTransferItem, AppSettings } from '../types';
import { Pagination } from '../components/Pagination';
import Modal from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { DeleteIcon, PlusIcon, EyeIcon, EditIcon, PrintIcon } from '../constants';
import { useReactToPrint } from 'react-to-print';
import { TransferNote } from '../components/TransferNote';

const TransfersPage: React.FC = () => {
    const { hasPermission } = useAuth();
    const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state for transfer details
    const [formState, setFormState] = useState({
        fromWarehouseId: '',
        toWarehouseId: '',
        driverName: '',
    });
    
    // State for the list of items to transfer
    const [transferItems, setTransferItems] = useState<WarehouseTransferItem[]>([]);
    
    // Temporary state for adding a new item
    const [currentItem, setCurrentItem] = useState({
        productId: '',
        quantity: 1
    });
    
    const [productSearch, setProductSearch] = useState('');
    
    // Filters
    const [filters, setFilters] = useState({
        fromWarehouseId: 'all',
        toWarehouseId: 'all',
        productId: 'all',
        startDate: '',
        endDate: '',
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [showAll, setShowAll] = useState(false);
    
    // State for viewing transfer details
    const [selectedTransfer, setSelectedTransfer] = useState<WarehouseTransfer | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [limitCount, setLimitCount] = useState(50);

    // Printing
    const [transferToPrint, setTransferToPrint] = useState<WarehouseTransfer | null>(null);
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrintProcess = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Transfert_${transferToPrint?.id || ''}`
    });

    const onPrintClick = (transfer: WarehouseTransfer) => {
        setTransferToPrint(transfer);
        setTimeout(() => {
            handlePrintProcess();
        }, 100);
    };

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const transfersQuery = query(collection(db, "warehouseTransfers"), orderBy("date", "desc"), limit(limitCount));
            const [transfersSnap, productsSnap, warehousesSnap] = await Promise.all([
                getDocs(transfersQuery),
                getDocs(collection(db, "products")),
                getDocs(collection(db, "warehouses")),
            ]);
            setTransfers(transfersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WarehouseTransfer)));
            setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
            setWarehouses(warehousesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
        } catch (err) {
            setError("Impossible de charger les données des transferts.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [limitCount]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

    const handleFormChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormState(prev => {
            // Si on change l'entrepôt de départ et qu'il est identique à celui d'arrivée, on réinitialise l'arrivée
            if (name === 'fromWarehouseId' && value === prev.toWarehouseId) {
                return { ...prev, [name]: value, toWarehouseId: '' };
            }
            return { ...prev, [name]: value };
        });
    };

    const handleItemChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        setCurrentItem(prev => ({...prev, [name]: name === 'quantity' ? parseInt(value) || 1 : value }));
    };
    
    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({...prev, [name]: value }));
    };

    const getAvailableStock = (productId: string, warehouseId: string): number => {
        if (!productId || !warehouseId) return 0;
        const product = products.find(p => p.id === productId);
        return product?.stockLevels?.find(sl => sl.warehouseId === warehouseId)?.quantity || 0;
    };
    
    const availableStock = useMemo(() => {
        return getAvailableStock(currentItem.productId, formState.fromWarehouseId);
    }, [currentItem.productId, formState.fromWarehouseId, products]);

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        return products.filter(p =>
            p.type !== 'service' &&
            ((p.name && p.name.toLowerCase().includes(productSearch.toLowerCase())) ||
            (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())))
        ).slice(0, 5);
    }, [productSearch, products]);

    const handleAddItem = () => {
        const { productId, quantity } = currentItem;
        if (!productId || quantity <= 0) return;
        
        if (!formState.fromWarehouseId) {
            setError("Veuillez sélectionner l'entrepôt de départ avant d'ajouter des produits.");
            return;
        }

        // Validate stock availability
        if (quantity > availableStock) {
            setError(`Quantité demandée (${quantity}) supérieure au stock disponible (${availableStock}).`);
            return;
        }

        // Check if item already exists in the list
        const existingItemIndex = transferItems.findIndex(item => item.productId === productId);
        
        if (existingItemIndex > -1) {
             // Create a deep copy of the items array to avoid mutation
             const newItems = transferItems.map(item => ({...item}));
             
             const currentInList = newItems[existingItemIndex].quantity;
             
             if (currentInList + quantity > availableStock) {
                 setError(`La quantité totale (${currentInList + quantity}) dépasse le stock disponible (${availableStock}).`);
                 return;
             }
             
             newItems[existingItemIndex].quantity += quantity;
             setTransferItems(newItems);
        } else {
            setTransferItems([...transferItems, { productId, quantity }]);
        }
        
        // Reset current item input
        setCurrentItem(prev => ({ ...prev, quantity: 1, productId: '' }));
        setProductSearch('');
        setError(null);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...transferItems];
        newItems.splice(index, 1);
        setTransferItems(newItems);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const { fromWarehouseId, toWarehouseId } = formState;

        if (!fromWarehouseId || !toWarehouseId) {
            setError("Veuillez sélectionner les entrepôts de départ et d'arrivée.");
            return;
        }
        if (fromWarehouseId === toWarehouseId) {
            setError("L'entrepôt de départ et de destination ne peuvent pas être identiques.");
            return;
        }
        if (transferItems.length === 0) {
            setError("Veuillez ajouter au moins un produit au transfert.");
            return;
        }
        
        setIsSubmitting(true);
        setError(null);
        
        try {
            await runTransaction(db, async (transaction) => {
                // 1. READ ALL DATA FIRST
                const productReads = [];
                for (const item of transferItems) {
                    const productRef = doc(db, 'products', item.productId);
                    productReads.push({ ref: productRef, item });
                }

                const productDocs = await Promise.all(productReads.map(p => transaction.get(p.ref)));
                
                // 2. VALIDATE AND PREPARE UPDATES
                const updates = [];
                
                for (let i = 0; i < productDocs.length; i++) {
                    const docSnapshot = productDocs[i];
                    const { item, ref } = productReads[i];

                    if (!docSnapshot.exists()) {
                        throw new Error(`Produit ${item.productId} non trouvé.`);
                    }

                    const productData = docSnapshot.data() as Product;
                    const stockLevels = [...(productData.stockLevels || [])];
                    
                    const fromWhIndex = stockLevels.findIndex(sl => sl.warehouseId === fromWarehouseId);
                    const toWhIndex = stockLevels.findIndex(sl => sl.warehouseId === toWarehouseId);

                    if (fromWhIndex === -1 || stockLevels[fromWhIndex].quantity < item.quantity) {
                         throw new Error(`Stock insuffisant pour ${productData.name}. Disponible: ${fromWhIndex > -1 ? stockLevels[fromWhIndex].quantity : 0}, Demandé: ${item.quantity}`);
                    }
                    
                    // Decrease from warehouse
                    stockLevels[fromWhIndex].quantity -= item.quantity;
                    
                    // Increase in to warehouse
                    if (toWhIndex > -1) {
                        stockLevels[toWhIndex].quantity += item.quantity;
                    } else {
                        stockLevels.push({ warehouseId: toWarehouseId, quantity: item.quantity });
                    }
                    
                    updates.push({ ref, stockLevels });
                }

                // 3. EXECUTE ALL WRITES
                for (const update of updates) {
                    transaction.update(update.ref, { stockLevels: update.stockLevels });
                }
                
                const newTransfer: Omit<WarehouseTransfer, 'id'> = {
                    date: new Date().toISOString(),
                    fromWarehouseId,
                    toWarehouseId,
                    items: transferItems,
                    status: 'Complété',
                    driverName: formState.driverName
                };
                
                const transferRef = doc(collection(db, "warehouseTransfers"));
                transaction.set(transferRef, newTransfer as DocumentData);
            });
            
            await fetchData();
            setFormState({ fromWarehouseId: '', toWarehouseId: '', driverName: '' });
            setTransferItems([]);
            setCurrentItem({ productId: '', quantity: 1 });
            setProductSearch('');
            
        } catch(err: any) {
            setError(`Échec du transfert: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const getWarehouseName = (id: string) => warehouses.find(w => w.id === id)?.name || 'N/A';
    const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'N/A';
    const getProductSku = (id: string) => products.find(p => p.id === id)?.sku || '';

    const handleViewDetails = (transfer: WarehouseTransfer) => {
        setSelectedTransfer(transfer);
        setShowDetailModal(true);
    };

    const handleDeleteTransfer = async (transfer: WarehouseTransfer) => {
        if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce transfert ? Cette action annulera les mouvements de stock associés.")) return;

        setLoading(true);
        try {
            await runTransaction(db, async (transaction) => {
                const transferRef = doc(db, 'warehouseTransfers', transfer.id);
                const transferDoc = await transaction.get(transferRef);
                if (!transferDoc.exists()) throw new Error("Transfert introuvable.");

                const itemsToRevert = transfer.items || (transfer.productId ? [{ productId: transfer.productId, quantity: transfer.quantity || 0 }] : []);

                const productReads = itemsToRevert.map(item => ({ 
                    ref: doc(db, 'products', item.productId), 
                    item 
                }));
                const productDocs = await Promise.all(productReads.map(p => transaction.get(p.ref)));

                const updates = [];
                for (let i = 0; i < productDocs.length; i++) {
                    const docSnapshot = productDocs[i];
                    const { item, ref } = productReads[i];

                    if (!docSnapshot.exists()) throw new Error(`Produit ${item.productId} non trouvé.`);

                    const productData = docSnapshot.data() as Product;
                    const stockLevels = [...(productData.stockLevels || [])];

                    const fromWhIndex = stockLevels.findIndex(sl => sl.warehouseId === transfer.fromWarehouseId);
                    const toWhIndex = stockLevels.findIndex(sl => sl.warehouseId === transfer.toWarehouseId);

                    if (toWhIndex === -1 || stockLevels[toWhIndex].quantity < item.quantity) {
                        throw new Error(`Impossible d'annuler : Stock insuffisant dans l'entrepôt de destination (${getWarehouseName(transfer.toWarehouseId)}) pour ${productData.name}.`);
                    }

                    stockLevels[toWhIndex].quantity -= item.quantity;
                    if (fromWhIndex > -1) {
                        stockLevels[fromWhIndex].quantity += item.quantity;
                    } else {
                        stockLevels.push({ warehouseId: transfer.fromWarehouseId, quantity: item.quantity });
                    }

                    updates.push({ ref, stockLevels });
                }

                for (const update of updates) {
                    transaction.update(update.ref, { stockLevels: update.stockLevels });
                }
                transaction.delete(transferRef);
            });

            await fetchData();
            setError(null);
        } catch (err: any) {
            setError(`Erreur lors de la suppression : ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleEditTransfer = async (transfer: WarehouseTransfer) => {
        if (!window.confirm("Pour modifier ce transfert, il sera d'abord annulé (stock rétabli) et le formulaire sera pré-rempli. Continuer ?")) return;

        setLoading(true);
        try {
            await runTransaction(db, async (transaction) => {
                const transferRef = doc(db, 'warehouseTransfers', transfer.id);
                const transferDoc = await transaction.get(transferRef);
                if (!transferDoc.exists()) throw new Error("Transfert introuvable.");

                const itemsToRevert = transfer.items || (transfer.productId ? [{ productId: transfer.productId, quantity: transfer.quantity || 0 }] : []);
                
                const productReads = itemsToRevert.map(item => ({ ref: doc(db, 'products', item.productId), item }));
                const productDocs = await Promise.all(productReads.map(p => transaction.get(p.ref)));

                const updates = [];
                for (let i = 0; i < productDocs.length; i++) {
                    const docSnapshot = productDocs[i];
                    const { item, ref } = productReads[i];
                    if (!docSnapshot.exists()) throw new Error(`Produit ${item.productId} non trouvé.`);

                    const productData = docSnapshot.data() as Product;
                    const stockLevels = [...(productData.stockLevels || [])];
                    const fromWhIndex = stockLevels.findIndex(sl => sl.warehouseId === transfer.fromWarehouseId);
                    const toWhIndex = stockLevels.findIndex(sl => sl.warehouseId === transfer.toWarehouseId);

                    if (toWhIndex === -1 || stockLevels[toWhIndex].quantity < item.quantity) {
                        throw new Error(`Impossible de modifier : Stock insuffisant dans l'entrepôt de destination pour ${productData.name}.`);
                    }

                    stockLevels[toWhIndex].quantity -= item.quantity;
                    if (fromWhIndex > -1) {
                        stockLevels[fromWhIndex].quantity += item.quantity;
                    } else {
                        stockLevels.push({ warehouseId: transfer.fromWarehouseId, quantity: item.quantity });
                    }
                    updates.push({ ref, stockLevels });
                }

                for (const update of updates) {
                    transaction.update(update.ref, { stockLevels: update.stockLevels });
                }
                transaction.delete(transferRef);
            });

            await fetchData();
            setFormState({
                fromWarehouseId: transfer.fromWarehouseId,
                toWarehouseId: transfer.toWarehouseId
            });
            
            const itemsToLoad = transfer.items || (transfer.productId ? [{ productId: transfer.productId, quantity: transfer.quantity || 0 }] : []);
            setTransferItems(itemsToLoad);
            
            setError(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (err: any) {
            setError(`Erreur lors de la préparation à la modification : ${err.message}`);
        } finally {
            setLoading(false);
        }
    };
    
    const filteredTransfers = useMemo(() => {
        return transfers.filter(t => {
            const fromMatch = filters.fromWarehouseId === 'all' || t.fromWarehouseId === filters.fromWarehouseId;
            const toMatch = filters.toWarehouseId === 'all' || t.toWarehouseId === filters.toWarehouseId;
            
            // Filter by product (checks either single productId or items array)
            let productMatch = filters.productId === 'all';
            if (!productMatch) {
                if (t.productId) {
                    productMatch = t.productId === filters.productId;
                } else if (t.items) {
                    productMatch = t.items.some(item => item.productId === filters.productId);
                }
            }
            
            let dateMatch = true;
            if (filters.startDate) {
                const startDate = new Date(filters.startDate);
                startDate.setHours(0, 0, 0, 0);
                dateMatch = dateMatch && new Date(t.date) >= startDate;
            }
            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                endDate.setHours(23, 59, 59, 999);
                dateMatch = dateMatch && new Date(t.date) <= endDate;
            }
            return fromMatch && toMatch && productMatch && dateMatch;
        });
    }, [transfers, filters]);

    const paginatedTransfers = useMemo(() => {
        if (showAll) return filteredTransfers;
        return filteredTransfers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    }, [filteredTransfers, currentPage, itemsPerPage, showAll]);
    
    const totalPages = Math.ceil(filteredTransfers.length / itemsPerPage);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-fit">
                <h2 className="text-xl font-bold mb-4">Nouveau Transfert</h2>
                {hasPermission('transfers') ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && <div className="p-3 my-2 text-sm text-red-700 bg-red-100 rounded-md">{error}</div>}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm">De (Entrepôt)</label>
                                <select 
                                    name="fromWarehouseId" 
                                    value={formState.fromWarehouseId} 
                                    onChange={handleFormChange} 
                                    required 
                                    disabled={transferItems.length > 0}
                                    className={`w-full mt-1 border rounded p-2 dark:bg-gray-700 ${transferItems.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <option value="">-- Sélectionner --</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                                {transferItems.length > 0 && <p className="text-xs text-gray-500 mt-1">Videz la liste pour changer l'entrepôt de départ.</p>}
                            </div>
                            <div>
                                <label className="block text-sm">À (Entrepôt)</label>
                                <select name="toWarehouseId" value={formState.toWarehouseId} onChange={handleFormChange} required className="w-full mt-1 border rounded p-2 dark:bg-gray-700">
                                    <option value="">-- Sélectionner --</option>
                                    {warehouses.filter(w => w.id !== formState.fromWarehouseId).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm">Nom du chauffeur</label>
                                <input 
                                    type="text" 
                                    name="driverName" 
                                    value={formState.driverName} 
                                    onChange={handleFormChange} 
                                    placeholder="Nom du chauffeur (optionnel)" 
                                    className="w-full mt-1 border rounded p-2 dark:bg-gray-700"
                                />
                            </div>
                        </div>

                        <div className="border-t border-b py-4 my-4">
                            <h3 className="text-sm font-semibold mb-2">Ajouter des produits</h3>
                            <div className="space-y-3">
                                <div className="relative">
                                    <label className="block text-sm">Produit</label>
                                    <input
                                        type="text"
                                        value={productSearch}
                                        onChange={e => {
                                            setProductSearch(e.target.value);
                                            if (currentItem.productId) {
                                                setCurrentItem(prev => ({...prev, productId: ''}));
                                            }
                                        }}
                                        disabled={!formState.fromWarehouseId}
                                        placeholder={!formState.fromWarehouseId ? "Sélectionnez d'abord un entrepôt" : "Rechercher un produit..."}
                                        className="w-full mt-1 border rounded p-2 dark:bg-gray-700"
                                    />
                                    {productSearch && filteredProducts.length > 0 && !currentItem.productId && (
                                        <ul className="absolute z-10 w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                                            {filteredProducts.map(p => (
                                                <li key={p.id} 
                                                    className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                                    onClick={() => {
                                                        setCurrentItem(prev => ({...prev, productId: p.id}));
                                                        setProductSearch(p.name);
                                                    }}>
                                                    {p.name} ({p.sku})
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                
                                {currentItem.productId && (
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            <label className="block text-sm">Quantité</label>
                                            <input 
                                                type="number" 
                                                name="quantity" 
                                                min="1" 
                                                max={availableStock > 0 ? availableStock : undefined} 
                                                value={currentItem.quantity} 
                                                onChange={handleItemChange} 
                                                className="w-full mt-1 border rounded p-2 dark:bg-gray-700"
                                            />
                                        </div>
                                        <div className="pb-1 text-sm text-gray-500 w-24">
                                            Stock: {availableStock}
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={handleAddItem}
                                            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 mb-0.5"
                                        >
                                            <PlusIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {transferItems.length > 0 && (
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold mb-2">Produits à transférer ({transferItems.length})</h3>
                                <div className="bg-gray-50 dark:bg-gray-700 rounded p-2 max-h-60 overflow-y-auto">
                                    <ul className="space-y-2">
                                        {transferItems.map((item, index) => (
                                            <li key={`${item.productId}-${index}`} className="flex justify-between items-center bg-white dark:bg-gray-600 p-2 rounded shadow-sm">
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm">{getProductName(item.productId)}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-300">Qté: {item.quantity}</div>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveItem(index)}
                                                    className="text-red-500 hover:text-red-700 p-1"
                                                >
                                                    <DeleteIcon className="w-4 h-4" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        <button type="submit" disabled={isSubmitting || transferItems.length === 0} className="w-full px-4 py-2 text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:bg-primary-300 disabled:cursor-not-allowed">
                            {isSubmitting ? 'Transfert en cours...' : 'Valider le transfert'}
                        </button>
                    </form>
                ) : (
                    <p className="text-sm text-gray-500">Vous n'avez pas la permission d'effectuer des transferts.</p>
                )}
            </div>
            <div className="lg:col-span-2">
                 <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-xl font-bold">Historique des transferts</h2>
                        <p className="text-xs text-gray-500 mt-1">Affichage des {limitCount} derniers transferts</p>
                    </div>
                    <div className="flex space-x-2">
                        <button onClick={() => setLimitCount(prev => prev + 500)} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-bold uppercase text-xs transition-colors">
                            Charger +
                        </button>
                        <button 
                            onClick={() => setShowAll(!showAll)} 
                            className="px-3 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-bold uppercase text-xs transition-colors"
                        >
                            {showAll ? 'Vue par page' : 'Tout afficher'}
                        </button>
                    </div>
                 </div>

                <div className="mb-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <select name="fromWarehouseId" value={filters.fromWarehouseId} onChange={handleFilterChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700">
                            <option value="all">De: Tous</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        <select name="toWarehouseId" value={filters.toWarehouseId} onChange={handleFilterChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700">
                            <option value="all">À: Tous</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        <select name="productId" value={filters.productId} onChange={handleFilterChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700">
                            <option value="all">Tous les produits</option>
                            {products.filter(p => p.type !== 'service').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><label className="text-sm">Date début</label><input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="w-full mt-1 px-3 py-2 border rounded-md dark:bg-gray-700"/></div>
                            <div><label className="text-sm">Date fin</label><input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="w-full mt-1 px-3 py-2 border rounded-md dark:bg-gray-700"/></div>
                        </div>
                    </div>
                </div>

                 {loading ? <p>Chargement...</p> : (
                    <>
                    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                             <thead className="bg-primary-600">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Produits</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">De</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">À</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Chauffeur</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-white uppercase">Actions</th>
                                </tr>
                            </thead>
                             <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {paginatedTransfers.map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 whitespace-nowrap">{new Date(t.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">
                                            {t.items && t.items.length > 0 ? (
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-700 dark:text-gray-300">{t.items.length} produit(s)</span>
                                                    <span className="text-xs text-gray-500 truncate max-w-[200px]">
                                                        {t.items.map(i => getProductName(i.productId)).join(', ')}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-sm">
                                                    {t.productId ? `${getProductName(t.productId)}: ${t.quantity}` : 'Détails manquants'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">
                                                {getWarehouseName(t.fromWarehouseId)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                                                {getWarehouseName(t.toWarehouseId)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                            {t.driverName || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button 
                                                    onClick={() => handleViewDetails(t)}
                                                    className="text-blue-600 hover:text-blue-800 bg-blue-50 p-2 rounded-lg transition-colors"
                                                    title="Voir les détails"
                                                >
                                                    <EyeIcon className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    onClick={() => onPrintClick(t)}
                                                    className="text-gray-700 hover:text-gray-900 bg-gray-100 p-2 rounded-lg transition-colors"
                                                    title="Imprimer Bon de Transfert"
                                                >
                                                    <PrintIcon className="w-5 h-5" />
                                                </button>
                                                {hasPermission('transfers') && (
                                                    <>
                                                        <button 
                                                            onClick={() => handleEditTransfer(t)}
                                                            className="text-yellow-600 hover:text-yellow-800 bg-yellow-50 p-2 rounded-lg transition-colors"
                                                            title="Modifier (Annuler & Recréer)"
                                                        >
                                                            <EditIcon className="w-5 h-5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteTransfer(t)}
                                                            className="text-red-600 hover:text-red-800 bg-red-50 p-2 rounded-lg transition-colors"
                                                            title="Supprimer (Annuler transfert)"
                                                        >
                                                            <DeleteIcon className="w-5 h-5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                     {!showAll && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filteredTransfers.length} itemsPerPage={itemsPerPage} />}
                    </>
                 )}
            </div>
            
            {/* Hidden Print Component */}
            <div className="hidden">
                {transferToPrint && (
                    <TransferNote 
                        ref={printRef}
                        transfer={transferToPrint}
                        fromWarehouseName={getWarehouseName(transferToPrint.fromWarehouseId)}
                        toWarehouseName={getWarehouseName(transferToPrint.toWarehouseId)}
                        products={products}
                        settings={settings}
                    />
                )}
            </div>

            {/* Transfer Details Modal */}
            <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="DÉTAILS DU TRANSFERT">
                {selectedTransfer && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl">
                            <div>
                                <p className="text-xs font-black uppercase text-gray-400 mb-1">Date du transfert</p>
                                <p className="font-bold text-lg">{new Date(selectedTransfer.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                <p className="text-sm text-gray-500">{new Date(selectedTransfer.date).toLocaleTimeString('fr-FR')}</p>
                            </div>
                            <div className="text-right">
                                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-black uppercase tracking-wider">
                                    {selectedTransfer.status || 'Complété'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 border rounded-xl bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30">
                                <p className="text-xs font-black uppercase text-red-400 mb-2">Entrepôt de Départ</p>
                                <p className="font-bold text-lg text-red-700 dark:text-red-400">{getWarehouseName(selectedTransfer.fromWarehouseId)}</p>
                            </div>
                            <div className="p-4 border rounded-xl bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30">
                                <p className="text-xs font-black uppercase text-green-400 mb-2">Entrepôt d'Arrivée</p>
                                <p className="font-bold text-lg text-green-700 dark:text-green-400">{getWarehouseName(selectedTransfer.toWarehouseId)}</p>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-black uppercase text-sm text-gray-500 mb-3 tracking-wider border-b pb-2">Produits Transférés</h3>
                            <div className="bg-white dark:bg-gray-800 border rounded-xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-900">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-bold text-gray-500">Produit</th>
                                            <th className="px-4 py-3 text-right font-bold text-gray-500">Quantité</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700">
                                        {selectedTransfer.items && selectedTransfer.items.length > 0 ? (
                                            selectedTransfer.items.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold">{getProductName(item.productId)}</div>
                                                        <div className="text-xs text-gray-400">{getProductSku(item.productId)}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold">{item.quantity}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td className="px-4 py-3">
                                                    <div className="font-bold">{selectedTransfer.productId ? getProductName(selectedTransfer.productId) : 'N/A'}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold">{selectedTransfer.quantity || 0}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                            <button 
                                onClick={() => setShowDetailModal(false)}
                                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default TransfersPage;
