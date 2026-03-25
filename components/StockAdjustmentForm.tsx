import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { supabase } from '../supabase';
import { StockAdjustment, Product } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { PlusIcon, DeleteIcon } from '../constants';

const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Define locally if not in types
interface LocalPendingAdjustment {
    id: string;
    warehouseId: string;
    productId: string;
    type: 'addition' | 'subtraction';
    quantity: number;
    reason: string;
}

const StockAdjustmentForm: React.FC = () => {
    const { user } = useAuth();
    const { products, warehouses, refreshData } = useData();
    const { addToast } = useToast();
    
    const [pendingAdjustments, setPendingAdjustments] = useState<LocalPendingAdjustment[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [formState, setFormState] = useState<Partial<Omit<StockAdjustment, 'id'>>>({
        date: new Date().toISOString().split('T')[0],
        warehouseId: '',
        productId: '',
        type: 'addition',
        quantity: 1,
        reason: ''
    });
    
    const [productSearch, setProductSearch] = useState('');

    // Initial setup for form
    React.useEffect(() => {
        if (warehouses.length > 0 && !formState.warehouseId) {
            setFormState(prev => ({ ...prev, warehouseId: warehouses[0].id }));
        }
    }, [warehouses]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const getProductName = (productId: string) => {
        const product = products.find(p => p.id === productId);
        return product ? product.name : 'Produit inconnu';
    };

    const getWarehouseName = (warehouseId: string) => {
        const warehouse = warehouses.find(w => w.id === warehouseId);
        return warehouse ? warehouse.name : 'Entrepôt inconnu';
    };

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        return products.filter(p => 
            (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.sku.toLowerCase().includes(productSearch.toLowerCase()))
        ).slice(0, 5);
    }, [productSearch, products]);

    const handleAddPending = (e: FormEvent) => {
        e.preventDefault();
        if (!formState.warehouseId || !formState.productId || !formState.quantity || !formState.reason) {
            setError('Tous les champs sont obligatoires.');
            return;
        }

        const newPending: LocalPendingAdjustment = {
            id: Date.now().toString(),
            warehouseId: formState.warehouseId!,
            productId: formState.productId!,
            type: formState.type as 'addition' | 'subtraction' || 'addition',
            quantity: Number(formState.quantity),
            reason: formState.reason!
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
        setSuccessMessage(null);
    };

    const handleRemovePending = (id: string) => {
        setPendingAdjustments(pendingAdjustments.filter(p => p.id !== id));
    };

    const handleSaveAll = async () => {
        if (pendingAdjustments.length === 0) return;
        
        setIsSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            // Traiter les ajustements séquentiellement
            for (const adj of pendingAdjustments) {
                // 1. Récupérer le produit à jour
                const { data: product, error: fetchError } = await supabase
                    .from('products')
                    .select('*')
                    .eq('id', adj.productId)
                    .single();
                
                if (fetchError || !product) {
                    throw new Error(`Produit introuvable: ${adj.productId}`);
                }

                const stockLevels = [...(product.stockLevels || [])];

                // 2. Calculer le nouveau stock
                const stockIndex = stockLevels.findIndex((sl: any) => sl.warehouseId === adj.warehouseId);
                const currentStock = stockIndex >= 0 ? Number(stockLevels[stockIndex].quantity) : 0;
                
                const adjQty = Number(adj.quantity);
                const change = adj.type === 'addition' ? adjQty : -adjQty;
                const newStock = currentStock + change;

                if (newStock < 0) {
                    throw new Error(`Stock insuffisant pour ${product.name} (Stock actuel: ${currentStock}, Demandé: ${change})`);
                }

                // 3. Mettre à jour les niveaux de stock
                if (stockIndex >= 0) {
                    stockLevels[stockIndex].quantity = newStock;
                } else {
                    stockLevels.push({ warehouseId: adj.warehouseId, quantity: newStock });
                }

                // 4. Mettre à jour le produit dans Supabase
                const { error: updateError } = await supabase
                    .from('products')
                    .update({ stockLevels })
                    .eq('id', adj.productId);

                if (updateError) throw updateError;

                // 5. Créer l'enregistrement d'ajustement
                const adjustmentId = generateUUID();
                const adjustmentData = {
                    id: adjustmentId,
                    warehouseId: adj.warehouseId,
                    productId: adj.productId,
                    type: adj.type,
                    quantity: adjQty,
                    reason: adj.reason,
                    date: new Date().toISOString(),
                    createdByUserId: user!.uid
                };

                const { error: insertError } = await supabase
                    .from('stock_adjustments')
                    .insert(adjustmentData);

                if (insertError) throw insertError;
            }

            setPendingAdjustments([]);
            setFormState(prev => ({
                ...prev,
                reason: '' // Reset reason after successful save
            }));
            
            setSuccessMessage("Ajustements enregistrés avec succès !");
            addToast("Ajustements enregistrés avec succès !", 'success');
            
            // Refresh global products data to update stock levels
            refreshData(['products']);
        } catch (err: any) {
            console.error("Erreur lors de l'enregistrement groupé:", err);
            const errorMessage = err.message || "Une erreur est survenue lors de l'enregistrement.";
            setError(errorMessage);
            addToast(errorMessage, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 h-fit">
                <h2 className="text-xl font-black mb-6 uppercase text-gray-800 dark:text-white flex items-center">
                    <PlusIcon className="w-5 h-5 mr-2 text-primary-600" />
                    Nouvel Ajustement
                </h2>
                <form onSubmit={handleAddPending} className="space-y-5">
                {error && <div className="p-4 text-sm font-bold text-red-700 bg-red-50 rounded-xl border border-red-100">{error}</div>}
                {successMessage && <div className="p-4 text-sm font-bold text-green-700 bg-green-50 rounded-xl border border-green-100">{successMessage}</div>}
                
                <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Entrepôt</label>
                    <select 
                        name="warehouseId" 
                        value={formState.warehouseId} 
                        onChange={handleFormChange} 
                        required 
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-primary-500 font-bold text-gray-900 dark:text-white"
                    >
                        {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>

                <div className="relative">
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Produit</label>
                    <input
                        type="text"
                        value={productSearch}
                        onChange={e => {
                            setProductSearch(e.target.value);
                            if (formState.productId) {
                                setFormState(prev => ({...prev, productId: ''}));
                            }
                        }}
                        placeholder="Rechercher (Nom, SKU)..."
                        required={!formState.productId}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-primary-500 font-bold"
                    />
                    {productSearch && filteredProducts.length > 0 && !formState.productId && (
                        <ul className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 shadow-2xl rounded-xl overflow-hidden border dark:border-gray-700 max-h-60 overflow-y-auto">
                            {filteredProducts.map(product => (
                                <li 
                                    key={product.id} 
                                    onClick={() => {
                                        setFormState(prev => ({...prev, productId: product.id}));
                                        setProductSearch(product.name);
                                    }}
                                    className="px-4 py-3 hover:bg-primary-50 dark:hover:bg-gray-700 cursor-pointer text-sm font-bold border-b dark:border-gray-700 last:border-0"
                                >
                                    <div className="text-gray-900 dark:text-white">{product.name}</div>
                                    <div className="text-xs text-gray-500 font-medium">SKU: {product.sku} | Stock: {product.stockLevels?.find(s => s.warehouseId === formState.warehouseId)?.quantity || 0}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Type</label>
                        <div className="flex bg-gray-50 dark:bg-gray-900 p-1 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setFormState(prev => ({ ...prev, type: 'addition' }))}
                                className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-colors ${formState.type === 'addition' ? 'bg-green-500 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Ajout +
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormState(prev => ({ ...prev, type: 'subtraction' }))}
                                className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-colors ${formState.type === 'subtraction' ? 'bg-red-500 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Retrait -
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Quantité</label>
                        <input 
                            type="number" 
                            name="quantity" 
                            value={formState.quantity} 
                            onChange={handleFormChange} 
                            min="1" 
                            required 
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-primary-500 font-black text-center"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                        Motif / Raison <span className="text-red-500">*</span>
                    </label>
                    <textarea 
                        name="reason" 
                        value={formState.reason} 
                        onChange={handleFormChange} 
                        required 
                        rows={3}
                        placeholder="Ex: Inventaire annuel, Casse, Perte... (Obligatoire)"
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-primary-500 font-medium text-sm resize-none"
                    />
                </div>

                <button 
                    type="submit" 
                    className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-black uppercase tracking-wide hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-xl active:scale-95"
                >
                    Ajouter à la liste
                </button>
                </form>
            </div>

            <div className="lg:col-span-2">
                {pendingAdjustments.length > 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-blue-50 dark:bg-blue-900/10">
                            <h3 className="text-lg font-black text-blue-900 dark:text-blue-100 uppercase">Ajustements en attente ({pendingAdjustments.length})</h3>
                            <button 
                                onClick={handleSaveAll}
                                disabled={isSubmitting}
                                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black uppercase text-xs shadow-lg disabled:opacity-50 transition-all active:scale-95"
                            >
                                {isSubmitting ? 'Traitement...' : 'Valider Tout'}
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase">Produit</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-gray-500 uppercase">Opération</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-gray-500 uppercase">Quantité</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase">Motif</th>
                                        <th className="px-6 py-4 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                                    {pendingAdjustments.map((adj) => (
                                        <tr key={adj.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">{getProductName(adj.productId)}</div>
                                                <div className="text-xs text-gray-500">{getWarehouseName(adj.warehouseId)}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-full ${adj.type === 'addition' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {adj.type === 'addition' ? 'Ajout +' : 'Retrait -'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-sm font-black">{adj.quantity}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 italic max-w-[200px] truncate">{adj.reason}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleRemovePending(adj.id)} className="text-red-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg">
                                                    <DeleteIcon className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full p-12 text-center bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 text-gray-400">
                            <PlusIcon className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Aucun ajustement en attente</h3>
                        <p className="text-gray-500 text-sm max-w-xs">Utilisez le formulaire à gauche pour préparer vos ajustements de stock avant validation.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StockAdjustmentForm;