import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { StockAdjustment, Product } from '../types';
import { useData } from '../context/DataContext';
import { Pagination } from './Pagination';
import { DeleteIcon, PrintIcon } from '../constants';
import Modal from './Modal';
import StockAdjustmentListPrint from './StockAdjustmentListPrint';
import { useReactToPrint } from 'react-to-print';

/**
 * Convertit une date en objet Date JS valide.
 */
const parseDate = (dateField: any): Date => {
    if (!dateField) return new Date();
    const d = new Date(dateField);
    return isNaN(d.getTime()) ? new Date() : d;
};

const formatDate = (dateField: any): string => {
    return parseDate(dateField).toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
};

const StockAdjustmentHistory: React.FC = () => {
    const { products, warehouses, settings, refreshData } = useData();
    const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [limitCount, setLimitCount] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('stock_adjustments')
                .select('*')
                .order('date', { ascending: false })
                .limit(limitCount);
            
            if (fetchError) throw fetchError;
            
            setAdjustments((data || []) as StockAdjustment[]);
        } catch (err) {
            console.error("Erreur lors du chargement des données:", err);
            setError("Impossible de charger l'historique.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [limitCount]);

    const handleDeleteAdjustment = async (adjustment: StockAdjustment) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet ajustement ?')) return;
        
        try {
            // 1. Récupérer le produit à jour
            const { data: product, error: fetchError } = await supabase
                .from('products')
                .select('*')
                .eq('id', adjustment.productId)
                .single();

            if (fetchError || !product) {
                throw new Error('Produit non trouvé');
            }

            const stockLevels = [...(product.stockLevels || [])];
            const stockIndex = stockLevels.findIndex((sl: any) => sl.warehouseId === adjustment.warehouseId);
            const currentStock = stockIndex >= 0 ? Number(stockLevels[stockIndex].quantity) : 0;
            const adjQty = Number(adjustment.quantity);

            // 2. Calculer le nouveau stock (opération inverse)
            const newStock = adjustment.type === 'addition' 
                ? currentStock - adjQty
                : currentStock + adjQty;

            if (newStock < 0) {
                throw new Error("Impossible d'annuler cet ajustement : le stock deviendrait négatif.");
            }

            // 3. Mettre à jour les niveaux de stock
            if (stockIndex >= 0) {
                stockLevels[stockIndex].quantity = newStock;
            } else {
                stockLevels.push({ warehouseId: adjustment.warehouseId, quantity: newStock });
            }

            // 4. Mettre à jour le produit
            const { error: updateError } = await supabase
                .from('products')
                .update({ stockLevels })
                .eq('id', adjustment.productId);
            
            if (updateError) throw updateError;

            // 5. Supprimer l'ajustement
            const { error: deleteError } = await supabase
                .from('stock_adjustments')
                .delete()
                .eq('id', adjustment.id);

            if (deleteError) throw deleteError;
            
            // Mise à jour immédiate de l'état local
            setAdjustments(prev => prev.filter(a => a.id !== adjustment.id));
            
            // Refresh global products data to update stock levels
            if (refreshData) await refreshData(['products']);
        } catch (err: any) {
            console.error("Erreur lors de la suppression:", err);
            setError(err.message || "Impossible de supprimer l'ajustement.");
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

    const totalPageQuantity = useMemo(() => {
        return paginatedAdjustments.reduce((sum, adj) => sum + adj.quantity, 0);
    }, [paginatedAdjustments]);

    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: 'Historique des Ajustements'
    });

    return (
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-black uppercase text-gray-800 dark:text-white">Historique des Opérations</h2>
                <div className="flex space-x-2">
                     <button onClick={() => setLimitCount(prev => prev + 50)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 font-bold uppercase text-xs transition-colors">
                        Charger +
                    </button>
                    <button onClick={() => setIsPrintModalOpen(true)} className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-bold uppercase text-xs shadow-lg">
                        <PrintIcon className="w-4 h-4 mr-2" /> Imprimer
                    </button>
                </div>
            </div>

            {error && <div className="p-4 m-4 text-sm font-bold text-red-700 bg-red-50 rounded-xl border border-red-100">{error}</div>}

            {loading ? (
                 <div className="p-24 text-center text-gray-400 font-black uppercase tracking-widest animate-pulse">Chargement de l'historique...</div>
            ) : (
                <>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase">Produit / Entrepôt</th>
                                <th className="px-6 py-4 text-center text-[10px] font-black text-gray-500 uppercase">Type</th>
                                <th className="px-6 py-4 text-center text-[10px] font-black text-gray-500 uppercase">Quantité</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase">Motif</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {paginatedAdjustments.map(adj => (
                                <tr key={adj.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{formatDate(adj.date)}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-sm text-gray-900 dark:text-white">{getProductName(adj.productId)}</div>
                                        <div className="text-xs text-gray-500 uppercase">{getWarehouseName(adj.warehouseId)}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 inline-flex text-[10px] font-black uppercase rounded-full ${adj.type === 'addition' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {adj.type === 'addition' ? 'Addition' : 'Soustraction'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center font-black text-gray-900 dark:text-white">{adj.quantity}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 italic max-w-[200px] truncate">{adj.reason}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDeleteAdjustment(adj)}
                                            className="text-red-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-xl"
                                            title="Supprimer cet ajustement"
                                        >
                                            <DeleteIcon className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {adjustments.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic font-medium">Aucun historique d'ajustement trouvé</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-700">
                            <tr>
                                <td colSpan={3} className="px-6 py-3 text-right text-xs font-black uppercase text-gray-500">Total Page (Volume)</td>
                                <td className="px-6 py-3 text-center text-sm font-black text-primary-600">{totalPageQuantity}</td>
                                <td colSpan={2}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={adjustments.length} itemsPerPage={ITEMS_PER_PAGE} />
                </>
            )}

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

export default StockAdjustmentHistory;