import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, runTransaction, addDoc, DocumentData, query, orderBy } from 'firebase/firestore';
import { WarehouseTransfer, Product, Warehouse } from '../types';
import { Pagination } from '../components/Pagination';
import { useAuth } from '../hooks/useAuth';

const TransfersPage: React.FC = () => {
    const { hasPermission } = useAuth();
    const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formState, setFormState] = useState({
        fromWarehouseId: '',
        toWarehouseId: '',
        productId: '',
        quantity: 1,
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
    const ITEMS_PER_PAGE = 10;
    
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const transfersQuery = query(collection(db, "warehouseTransfers"), orderBy("date", "desc"));
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
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

    const handleFormChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({...prev, [name]: name === 'quantity' ? parseInt(value) || 1 : value }));
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
        return getAvailableStock(formState.productId, formState.fromWarehouseId);
    }, [formState.productId, formState.fromWarehouseId, products]);

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        return products.filter(p =>
            p.type !== 'service' &&
            (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.sku.toLowerCase().includes(productSearch.toLowerCase()))
        ).slice(0, 5);
    }, [productSearch, products]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const { fromWarehouseId, toWarehouseId, productId, quantity } = formState;

        if (!fromWarehouseId || !toWarehouseId || !productId || quantity <= 0) {
            setError("Veuillez remplir tous les champs.");
            return;
        }
        if (fromWarehouseId === toWarehouseId) {
            setError("L'entrepôt de départ et de destination ne peuvent pas être identiques.");
            return;
        }
        if (quantity > availableStock) {
            setError("Quantité de transfert supérieure au stock disponible.");
            return;
        }
        
        setIsSubmitting(true);
        setError(null);
        
        try {
            await runTransaction(db, async (transaction) => {
                const productRef = doc(db, 'products', productId);
                const productDoc = await transaction.get(productRef);
                if (!productDoc.exists()) throw new Error("Produit non trouvé.");

                const productData = productDoc.data() as Product;
                const stockLevels = [...(productData.stockLevels || [])];
                
                const fromWhIndex = stockLevels.findIndex(sl => sl.warehouseId === fromWarehouseId);
                const toWhIndex = stockLevels.findIndex(sl => sl.warehouseId === toWarehouseId);

                if (fromWhIndex === -1 || stockLevels[fromWhIndex].quantity < quantity) {
                    throw new Error("Stock insuffisant dans l'entrepôt de départ.");
                }
                
                // Decrease from warehouse
                stockLevels[fromWhIndex].quantity -= quantity;
                
                // Increase in to warehouse
                if (toWhIndex > -1) {
                    stockLevels[toWhIndex].quantity += quantity;
                } else {
                    stockLevels.push({ warehouseId: toWarehouseId, quantity });
                }
                
                transaction.update(productRef, { stockLevels });
                
                const newTransfer: Omit<WarehouseTransfer, 'id'> = {
                    date: new Date().toISOString(),
                    fromWarehouseId,
                    toWarehouseId,
                    productId,
                    quantity,
                    status: 'Complété' // Keep it simple, auto-complete
                };
                
                transaction.set(doc(collection(db, "warehouseTransfers")), newTransfer as DocumentData);
            });
            
            await fetchData();
            setFormState({ fromWarehouseId: '', toWarehouseId: '', productId: '', quantity: 1 });
            setProductSearch('');
            
        } catch(err: any) {
            setError(`Échec du transfert: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const getWarehouseName = (id: string) => warehouses.find(w => w.id === id)?.name || 'N/A';
    const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'N/A';
    
    const filteredTransfers = useMemo(() => {
        return transfers.filter(t => {
            const fromMatch = filters.fromWarehouseId === 'all' || t.fromWarehouseId === filters.fromWarehouseId;
            const toMatch = filters.toWarehouseId === 'all' || t.toWarehouseId === filters.toWarehouseId;
            const productMatch = filters.productId === 'all' || t.productId === filters.productId;
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
        return filteredTransfers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    }, [filteredTransfers, currentPage]);
    const totalPages = Math.ceil(filteredTransfers.length / ITEMS_PER_PAGE);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-fit">
                <h2 className="text-xl font-bold mb-4">Nouveau Transfert</h2>
                {hasPermission('transfers') ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && <div className="p-3 my-2 text-sm text-red-700 bg-red-100 rounded-md">{error}</div>}
                        <div className="relative">
                            <label className="block text-sm">Produit</label>
                            <input
                                type="text"
                                value={productSearch}
                                onChange={e => {
                                    setProductSearch(e.target.value);
                                    if (formState.productId) {
                                        setFormState(prev => ({...prev, productId: ''}));
                                    }
                                }}
                                placeholder="Rechercher un produit par nom ou SKU"
                                required={!formState.productId}
                                className="w-full mt-1 border rounded p-2 dark:bg-gray-700"
                            />
                            {productSearch && filteredProducts.length > 0 && !formState.productId && (
                                <ul className="absolute z-10 w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md mt-1 max-h-48 overflow-y-auto">
                                    {filteredProducts.map(p => (
                                        <li key={p.id} 
                                            className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                            onClick={() => {
                                                setFormState(prev => ({...prev, productId: p.id}));
                                                setProductSearch(p.name);
                                            }}>
                                            {p.name} ({p.sku})
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm">De (Entrepôt)</label>
                            <select name="fromWarehouseId" value={formState.fromWarehouseId} onChange={handleFormChange} required className="w-full mt-1 border rounded p-2 dark:bg-gray-700">
                                <option value="">-- Sélectionner --</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                            {formState.fromWarehouseId && <p className="text-xs text-gray-500 mt-1">Stock disponible: {availableStock}</p>}
                        </div>
                        <div>
                            <label className="block text-sm">À (Entrepôt)</label>
                            <select name="toWarehouseId" value={formState.toWarehouseId} onChange={handleFormChange} required className="w-full mt-1 border rounded p-2 dark:bg-gray-700">
                                <option value="">-- Sélectionner --</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm">Quantité</label>
                            <input type="number" name="quantity" min="1" max={availableStock > 0 ? availableStock : undefined} value={formState.quantity} onChange={handleFormChange} required className="w-full mt-1 border rounded p-2 dark:bg-gray-700"/>
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full px-4 py-2 text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:bg-primary-300">
                            {isSubmitting ? 'Transfert en cours...' : 'Transférer'}
                        </button>
                    </form>
                ) : (
                    <p className="text-sm text-gray-500">Vous n'avez pas la permission d'effectuer des transferts.</p>
                )}
            </div>
            <div className="lg:col-span-2">
                 <h2 className="text-xl font-bold mb-4">Historique des transferts</h2>

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
                    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                             <thead className="bg-primary-600">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Produit</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">De</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">À</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-white uppercase">Qté</th>
                                </tr>
                            </thead>
                             <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {paginatedTransfers.map(t => (
                                    <tr key={t.id}>
                                        <td className="px-6 py-4">{new Date(t.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 font-medium">{getProductName(t.productId)}</td>
                                        <td className="px-6 py-4">{getWarehouseName(t.fromWarehouseId)}</td>
                                        <td className="px-6 py-4">{getWarehouseName(t.toWarehouseId)}</td>
                                        <td className="px-6 py-4 text-right">{t.quantity}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                     <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filteredTransfers.length} itemsPerPage={ITEMS_PER_PAGE} />
                    </>
                 )}
            </div>
        </div>
    );
};

export default TransfersPage;