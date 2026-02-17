import React, { useState, useEffect, FormEvent, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, doc, runTransaction, DocumentData, query, orderBy } from 'firebase/firestore';
import { StockAdjustment, Product, Warehouse } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../context/DataContext';
import { Pagination } from '../components/Pagination';
import { DeleteIcon, PrintIcon, PlusIcon } from '../constants';
import Modal from '../components/Modal';
import { StockAdjustmentListPrint } from '../components/StockAdjustmentListPrint';
import { useReactToPrint } from 'react-to-print';

interface PendingAdjustment {
    id: string;
    warehouseId: string;
    productId: string;
    type: 'addition' | 'subtraction';
    quantity: number;
    reason: string;
}

const StockAdjustmentsPage: React.FC = () => {
    const { user } = useAuth();
    const { settings } = useData();
    const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
    const [pendingAdjustments, setPendingAdjustments] = useState<PendingAdjustment[]>([]);

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

            const adjustmentsData = adjSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockAdjustment));
            const productsData = prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            const warehousesData = whSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse));

            setAdjustments(adjustmentsData);
            setProducts(productsData);
            setWarehouses(warehousesData);

            if (warehousesData.length > 0 && !formState.warehouseId) {
                setFormState(prev => ({ ...prev, warehouseId: warehousesData[0].id }));
            }
        } catch (err) {
            console.error("Erreur lors du chargement des données:", err);
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
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleAddPending = (e: FormEvent) => {
        e.preventDefault();
        if (!formState.warehouseId || !formState.productId || !formState.quantity || !formState.reason) {
            setError('Tous les champs sont obligatoires.');
            return;
        }

        const newPending: PendingAdjustment = {
            id: Date.now().toString(),
            warehouseId: formState.warehouseId,
            productId: formState.productId,
            type: formState.type as 'addition' | 'subtraction' || 'addition',
            quantity: Number(formState.quantity),
            reason: formState.reason
        };

        setPendingAdjustments([...pendingAdjustments, newPending]);
        
        // Reset partiel pour faciliter l'ajout rapide
        setFormState(prev => ({
            ...prev,
            productId: '',
            quantity: 1,
            // On garde le même entrepôt et motif pour accélérer la saisie
        }));
        setProductSearch('');
        setError(null);
    };

    const handleRemovePending = (id: string) => {
        setPendingAdjustments(pendingAdjustments.filter(p => p.id !== id));
    };

    const handleSaveAll = async () => {
        if (pendingAdjustments.length === 0) return;
        
        setIsSubmitting(true);
        setError(null);

        try {
            await runTransaction(db, async (transaction) => {
                // 1. Identifier les produits uniques pour éviter les lectures multiples
                const uniqueProductIds = Array.from(new Set(pendingAdjustments.map(a => a.productId)));
                
                // 2. Lire tous les produits en une fois (avant toute écriture)
                const productRefs = uniqueProductIds.map(id => doc(db, 'products', id));
                const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));
                
                const productDataMap: Record<string, Product> = {};
                productDocs.forEach(docSnap => {
                    if (!docSnap.exists()) throw new Error(`Produit introuvable: ${docSnap.id}`);
                    productDataMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() } as Product;
                });

                // 3. Traiter les ajustements et calculer les nouveaux stocks
                for (const adj of pendingAdjustments) {
                    const product = productDataMap[adj.productId];
                    // Initialiser stockLevels s'il n'existe pas
                    if (!product.stockLevels) product.stockLevels = [];

                    // Trouver l'index pour l'entrepôt concerné
                    const stockIndex = product.stockLevels.findIndex(sl => sl.warehouseId === adj.warehouseId);
                    const currentStock = stockIndex >= 0 ? product.stockLevels[stockIndex].quantity : 0;
                    
                    const change = adj.type === 'addition' ? adj.quantity : -adj.quantity;
                    const newStock = currentStock + change;

                    if (newStock < 0) {
                        throw new Error(`Stock insuffisant pour ${product.name} (Stock actuel: ${currentStock}, Demandé: -${adj.quantity})`);
                    }

                    // Mise à jour locale pour les itérations suivantes
                    if (stockIndex >= 0) {
                        product.stockLevels[stockIndex].quantity = newStock;
                    } else {
                        product.stockLevels.push({ warehouseId: adj.warehouseId, quantity: newStock });
                    }

                    // Création de l'enregistrement d'ajustement
                    const adjustmentData = {
                        warehouseId: adj.warehouseId,
                        productId: adj.productId,
                        type: adj.type,
                        quantity: adj.quantity,
                        reason: adj.reason,
                        date: new Date().toISOString(),
                        createdByUserId: user!.uid
                    };
                    
                    const adjustmentRef = doc(collection(db, 'stockAdjustments'));
                    transaction.set(adjustmentRef, adjustmentData);
                }

                // 4. Appliquer les mises à jour de stock sur les produits (une seule fois par produit)
                uniqueProductIds.forEach(id => {
                    const productRef = doc(db, 'products', id);
                    transaction.update(productRef, { stockLevels: productDataMap[id].stockLevels });
                });
            });

            setPendingAdjustments([]);
            setFormState(prev => ({
                ...prev,
                reason: '' // Reset reason after successful save
            }));
            await fetchData();
        } catch (err: any) {
            console.error("Erreur lors de l'enregistrement groupé:", err);
            setError(err.message || "Une erreur est survenue lors de l'enregistrement.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteAdjustment = async (adjustment: StockAdjustment) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet ajustement ?')) return;
        
        try {
            await runTransaction(db, async (transaction) => {
                const adjustmentRef = doc(db, 'stockAdjustments', adjustment.id);
                const productRef = doc(db, 'products', adjustment.productId);
                const productDoc = await transaction.get(productRef);
                
                if (!productDoc.exists()) {
                    throw new Error('Produit non trouvé');
                }

                const productData = productDoc.data() as Product;
                const stockLevels = [...(productData.stockLevels || [])];
                const stockIndex = stockLevels.findIndex(sl => sl.warehouseId === adjustment.warehouseId);
                const currentStock = stockIndex >= 0 ? stockLevels[stockIndex].quantity : 0;

                // Calcul du nouveau stock après annulation de l'ajustement
                // Si c'était une addition, on soustrait. Si c'était une soustraction, on ajoute.
                const newStock = adjustment.type === 'addition' 
                    ? currentStock - adjustment.quantity
                    : currentStock + adjustment.quantity;

                if (newStock < 0) {
                    throw new Error("Impossible d'annuler cet ajustement : le stock deviendrait négatif.");
                }

                if (stockIndex >= 0) {
                    stockLevels[stockIndex].quantity = newStock;
                } else {
                    stockLevels.push({ warehouseId: adjustment.warehouseId, quantity: newStock });
                }

                transaction.delete(adjustmentRef);
                transaction.update(productRef, { stockLevels });
            });
            
            // Mise à jour immédiate de l'état local pour refléter les changements
            setAdjustments(prev => prev.filter(a => a.id !== adjustment.id));
            
            // Rechargement des données pour s'assurer de la cohérence avec le serveur
            await fetchData();
        } catch (err) {
            console.error("Erreur lors de la suppression:", err);
            setError("Impossible de supprimer l'ajustement.");
        }
    };

    const getProductName = (productId: string) => {
        const product = products.find(p => p.id === productId);
        return product ? product.name : 'Produit inconnu';
    };

    const getWarehouseName = (warehouseId: string) => {
        const warehouse = warehouses.find(w => w.id === warehouseId);
        return warehouse ? warehouse.name : 'Entrepôt inconnu';
    };

    const paginatedAdjustments = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return adjustments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [adjustments, currentPage]);

    const totalPages = Math.ceil(adjustments.length / ITEMS_PER_PAGE);

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        return products.filter(p => 
            (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.sku.toLowerCase().includes(productSearch.toLowerCase()))
        ).slice(0, 5);
    }, [productSearch, products]);

    const totalPageQuantity = useMemo(() => {
        return paginatedAdjustments.reduce((sum, adj) => sum + adj.quantity, 0);
    }, [paginatedAdjustments]);

    const totalGlobalQuantity = useMemo(() => {
        return adjustments.reduce((sum, adj) => sum + adj.quantity, 0);
    }, [adjustments]);

    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: 'Historique des Ajustements'
    });

    return (
        <div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-fit">
                    <h2 className="text-xl font-bold mb-4">Nouvel Ajustement</h2>
                    <form onSubmit={handleAddPending} className="space-y-4">
                    {error && <div className="p-3 my-2 text-sm text-red-700 bg-red-100 rounded-md">{error}</div>}
                    <div>
                        <label className="block text-sm">Entrepôt</label>
                        <select 
                            name="warehouseId" 
                            value={formState.warehouseId} 
                            onChange={handleFormChange} 
                            required 
                            className="w-full mt-1 border rounded p-2 dark:bg-gray-700"
                        >
                            {warehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>
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
                    <div>
                        <label className="block text-sm">Type</label>
                        <select 
                            name="type" 
                            value={formState.type} 
                            onChange={handleFormChange} 
                            className="w-full mt-1 border rounded p-2 dark:bg-gray-700"
                        >
                            <option value="addition">Addition</option>
                            <option value="subtraction">Soustraction</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm">Quantité</label>
                        <input 
                            type="number" 
                            name="quantity" 
                            min="1" 
                            value={formState.quantity} 
                            onChange={handleFormChange} 
                            required 
                            className="w-full mt-1 border rounded p-2 dark:bg-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-sm">Motif</label>
                        <textarea 
                            name="reason" 
                            value={formState.reason} 
                            onChange={handleFormChange} 
                            required 
                            rows={3} 
                            className="w-full mt-1 border rounded p-2 dark:bg-gray-700"
                        ></textarea>
                    </div>
                    <button type="submit" className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center justify-center gap-2">
                        <PlusIcon className="w-5 h-5" /> Ajouter à la liste
                    </button>
                </form>
            </div>
            <div className="lg:col-span-2 space-y-6">
                 {/* Pending Adjustments Table */}
                 {pendingAdjustments.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200">Ajustements en attente ({pendingAdjustments.length})</h3>
                            <button 
                                onClick={handleSaveAll}
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md disabled:opacity-50"
                            >
                                {isSubmitting ? 'Enregistrement...' : 'Valider tous les ajustements'}
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-blue-200 dark:divide-blue-800">
                                <thead className="bg-blue-100 dark:bg-blue-900/50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-blue-800 dark:text-blue-200 uppercase">Produit</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-blue-800 dark:text-blue-200 uppercase">Type</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-blue-800 dark:text-blue-200 uppercase">Qté</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-blue-800 dark:text-blue-200 uppercase">Motif</th>
                                        <th className="px-4 py-2 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-blue-200 dark:divide-blue-800 bg-white dark:bg-gray-800">
                                    {pendingAdjustments.map((adj) => (
                                        <tr key={adj.id}>
                                            <td className="px-4 py-2 text-sm">{getProductName(adj.productId)}</td>
                                            <td className="px-4 py-2 text-sm">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${adj.type === 'addition' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {adj.type === 'addition' ? '+' : '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-sm font-bold">{adj.quantity}</td>
                                            <td className="px-4 py-2 text-sm truncate max-w-[150px]">{adj.reason}</td>
                                            <td className="px-4 py-2 text-right">
                                                <button onClick={() => handleRemovePending(adj.id)} className="text-red-500 hover:text-red-700">
                                                    <DeleteIcon className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                 )}

                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Historique des ajustements</h2>
                    <button
                        onClick={() => setIsPrintModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                        <PrintIcon className="w-5 h-5" />
                        <span>Imprimer</span>
                    </button>
                 </div>
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
                                    <th className="px-6 py-3 text-right text-xs font-bold text-white uppercase">Actions</th>
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
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDeleteAdjustment(adj)}
                                                className="text-red-600 hover:text-red-900 transition-colors"
                                                title="Supprimer cet ajustement"
                                            >
                                                <DeleteIcon className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t-2 border-gray-200 dark:border-gray-700">
                                <tr className="bg-blue-50 dark:bg-blue-900/20">
                                    <td colSpan={3} className="px-6 py-3 text-right text-xs font-black uppercase text-gray-500">Total Page (Volume)</td>
                                    <td className="px-6 py-3 text-sm font-black text-gray-900 dark:text-white">{totalPageQuantity}</td>
                                    <td colSpan={2}></td>
                                </tr>
                                <tr className="bg-gray-100 dark:bg-gray-800">
                                    <td colSpan={3} className="px-6 py-3 text-right text-xs font-black uppercase text-gray-500">Total Global (Volume)</td>
                                    <td className="px-6 py-3 text-sm font-black text-gray-900 dark:text-white">{totalGlobalQuantity}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                     <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={adjustments.length} itemsPerPage={ITEMS_PER_PAGE} />
                    </>
                 )}
            </div>
            </div>

            {/* Print Modal */}
            <Modal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} title="Impression Historique Ajustements" maxWidth="max-w-4xl">
                <div className="flex flex-col items-center p-6">
                    <div className="w-full overflow-auto bg-gray-100 dark:bg-gray-700 p-4 rounded-xl mb-6 shadow-inner max-h-[70vh]">
                        <div className="transform scale-90 origin-top">
                            <StockAdjustmentListPrint 
                                ref={printRef}
                                adjustments={adjustments}
                                settings={settings}
                                products={products}
                                warehouses={warehouses}
                            />
                        </div>
                    </div>
                    <div className="flex gap-4 w-full justify-end">
                        <button onClick={() => setIsPrintModalOpen(false)} className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-bold uppercase">Fermer</button>
                        <button onClick={handlePrint} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase shadow-lg flex items-center"><PrintIcon className="w-5 h-5 mr-2" /> Imprimer</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default StockAdjustmentsPage;