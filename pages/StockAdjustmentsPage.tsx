import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, doc, runTransaction, DocumentData, query, orderBy } from 'firebase/firestore';
import { StockAdjustment, Product, Warehouse } from '../types';
import { useAuth } from '../hooks/useAuth';
// FIX: Changed import to be a named import.
import { Pagination } from '../components/Pagination';

const StockAdjustmentsPage: React.FC = () => {
    const { user } = useAuth();
    const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formState, setFormState] = useState<Partial<Omit<StockAdjustment, 'id'>>>({
        date: new Date().toISOString().split('T')[0],
        warehouseId: '',
        productId: '',
        type: 'addition',
        quantity: 1,
        reason: ''
    });
    
    const [productSearch, setProductSearch] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const adjQuery = query(collection(db, "stockAdjustments"), orderBy("date", "desc"));
            const [adjSnap, prodSnap, whSnap] = await Promise.all([
                getDocs(adjQuery),
                getDocs(collection(db, "products")),
                getDocs(collection(db, "warehouses"))
            ]);
            setAdjustments(adjSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockAdjustment)));
            setProducts(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
            const fetchedWarehouses = whSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse));
            setWarehouses(fetchedWarehouses);
            // Set default warehouse if not set
            if (!formState.warehouseId && fetchedWarehouses.length > 0) {
                setFormState(prev => ({ ...prev, warehouseId: fetchedWarehouses[0].id }));
            }
        } catch (err) {
            setError("Impossible de charger les données.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const isNumber = name === 'quantity';
        setFormState(prev => ({ ...prev, [name]: isNumber ? parseInt(value) || 0 : value }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const { warehouseId, productId, type, quantity, reason } = formState;
        if (!warehouseId || !productId || !quantity || !reason) {
            setError("Veuillez remplir tous les champs.");
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
                const stockLevels = productData.stockLevels || [];
                const whIndex = stockLevels.findIndex(sl => sl.warehouseId === warehouseId);
                const stockChange = type === 'addition' ? quantity : -quantity;
                
                if (whIndex > -1) {
                    if (stockLevels[whIndex].quantity + stockChange < 0) {
                        throw new Error("Stock insuffisant pour cette soustraction.");
                    }
                    stockLevels[whIndex].quantity += stockChange;
                } else {
                     if (stockChange < 0) throw new Error("Stock insuffisant pour cette soustraction.");
                     stockLevels.push({ warehouseId, quantity: stockChange });
                }
                
                transaction.update(productRef, { stockLevels });

                const newAdjustment: Omit<StockAdjustment, 'id'> = {
                    ...formState,
                    createdByUserId: user!.uid,
                    date: new Date().toISOString()
                } as Omit<StockAdjustment, 'id'>;

                transaction.set(doc(collection(db, "stockAdjustments")), newAdjustment as DocumentData);
            });
            
            await fetchData();
            // Reset form
            setFormState({
                date: new Date().toISOString().split('T')[0],
                warehouseId: warehouses.length > 0 ? warehouses[0].id : '', 
                productId: '', 
                type: 'addition', 
                quantity: 1, 
                reason: ''
            });
            setProductSearch('');

        } catch (err: any) {
            setError(`Échec de l'ajustement: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getWarehouseName = (id: string) => warehouses.find(w => w.id === id)?.name || 'N/A';
    const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'N/A';

    const paginatedAdjustments = useMemo(() => {
        return adjustments.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    }, [adjustments, currentPage]);
    const totalPages = Math.ceil(adjustments.length / ITEMS_PER_PAGE);

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        return products.filter(p =>
            p.type !== 'service' &&
            (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.sku.toLowerCase().includes(productSearch.toLowerCase()))
        ).slice(0, 5);
    }, [productSearch, products]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-fit">
                <h2 className="text-xl font-bold mb-4">Nouvel Ajustement</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <div className="p-3 my-2 text-sm text-red-700 bg-red-100 rounded-md">{error}</div>}
                    <div><label className="block text-sm">Entrepôt</label><select name="warehouseId" value={formState.warehouseId} onChange={handleFormChange} required className="w-full mt-1 border rounded p-2 dark:bg-gray-700">{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
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
                            placeholder="Rechercher par nom ou SKU"
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
                    <div><label className="block text-sm">Type</label><select name="type" value={formState.type} onChange={handleFormChange} className="w-full mt-1 border rounded p-2 dark:bg-gray-700"><option value="addition">Addition</option><option value="subtraction">Soustraction</option></select></div>
                    <div><label className="block text-sm">Quantité</label><input type="number" name="quantity" min="1" value={formState.quantity} onChange={handleFormChange} required className="w-full mt-1 border rounded p-2 dark:bg-gray-700"/></div>
                    <div><label className="block text-sm">Motif</label><textarea name="reason" value={formState.reason} onChange={handleFormChange} required rows={3} className="w-full mt-1 border rounded p-2 dark:bg-gray-700"></textarea></div>
                    <button type="submit" disabled={isSubmitting} className="w-full px-4 py-2 text-white bg-primary-600 rounded-md hover:bg-primary-700">{isSubmitting ? 'Enregistrement...' : 'Enregistrer'}</button>
                </form>
            </div>
            <div className="lg:col-span-2">
                 <h2 className="text-xl font-bold mb-4">Historique des ajustements</h2>
                 {loading ? <p>Chargement...</p> : (
                    <>
                    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                             <thead className="bg-primary-600">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Produit</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Qté</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-white uppercase">Motif</th>
                                </tr>
                            </thead>
                             <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {paginatedAdjustments.map(adj => (
                                    <tr key={adj.id}>
                                        <td className="px-6 py-4">{new Date(adj.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 font-medium">{getProductName(adj.productId)} ({getWarehouseName(adj.warehouseId)})</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${adj.type === 'addition' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {adj.type === 'addition' ? 'Addition' : 'Soustraction'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">{adj.quantity}</td>
                                        <td className="px-6 py-4">{adj.reason}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                     <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={adjustments.length} itemsPerPage={ITEMS_PER_PAGE} />
                    </>
                 )}
            </div>
        </div>
    );
};

export default StockAdjustmentsPage;