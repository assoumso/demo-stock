
import React, { useState, useEffect, useMemo } from 'react';

import { Product, Warehouse, Category, Brand } from '../types';
import { Pagination } from '../components/Pagination';
import { AdjustmentsIcon } from '../constants';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../context/DataContext';
import * as ReactWindow from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

const List = ReactWindow.FixedSizeList;

interface InventoryRowData {
    items: Product[];
    functions: {
        warehouses: Warehouse[];
        getSupplierName: (id?: string) => string;
        getStockForWarehouse: (product: Product, warehouseId: string) => number;
        getTotalStock: (product: Product) => number;
        getBorderColor: (color?: string) => string;
    };
}

interface InventoryRowProps {
    index: number;
    style: React.CSSProperties;
    data: InventoryRowData;
}

const InventoryRow = ({ index, style, data }: InventoryRowProps) => {
    const { items, functions } = data;
    const product = items[index];
    const { 
        warehouses, 
        getSupplierName, 
        getStockForWarehouse, 
        getTotalStock,
        getBorderColor
    } = functions;

    const totalStock = getTotalStock(product);
    const isLowStock = totalStock <= product.minStockAlert;
    
    return (
        <div style={style} className={`flex items-center ${isLowStock ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'} transition-colors border-b border-gray-100 dark:border-gray-700`}>
             <div className="px-6 py-4 whitespace-nowrap overflow-hidden flex-shrink-0" style={{ width: '250px' }}>
                <div className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight truncate" title={product.name}>{product.name}</div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">{product.sku}</div>
             </div>
             <div className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-500 dark:text-gray-400 uppercase truncate flex-shrink-0" style={{ width: '150px' }}>
                {getSupplierName(product.supplierId)}
             </div>
             {warehouses.map((wh: Warehouse) => {
                 const qty = getStockForWarehouse(product, wh.id);
                 return (
                     <div key={wh.id} className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold flex-shrink-0 ${qty <= 0 ? 'text-gray-300' : 'text-gray-700 dark:text-gray-200'}`} style={{ width: '100px' }}>
                         {qty}
                     </div>
                 );
             })}
             <div className="px-6 py-4 whitespace-nowrap text-sm font-black text-gray-900 dark:text-white text-right bg-gray-50/50 dark:bg-gray-900/20 flex-shrink-0" style={{ width: '100px' }}>
                 <span className={isLowStock ? 'text-red-600 animate-pulse' : ''}>{totalStock}</span>
             </div>
             <div className="px-6 py-4 whitespace-nowrap text-[10px] text-right font-black text-gray-400 uppercase tracking-widest flex-shrink-0" style={{ width: '100px' }}>
                 {product.minStockAlert}
             </div>
        </div>
    );
};

const InventoryPage: React.FC = () => {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();
    const { products, warehouses, categories, brands, suppliers, loading: dataLoading, productsLoading } = useData();
    const [loading, setLoading] = useState(true); // Keep local loading if needed for transition or just use dataLoading

    // Sync local loading with dataLoading
    useEffect(() => { setLoading(dataLoading || productsLoading); }, [dataLoading, productsLoading]);
    
    const [error, setError] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedBrand, setSelectedBrand] = useState('all');

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    const [showAll, setShowAll] = useState(false);

    // Removed manual fetch useEffect as we use useData
    
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedCategory, selectedBrand]);

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            if (p.type === 'service') return false; // Exclude services
            const searchMatch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
            const categoryMatch = selectedCategory === 'all' || p.categoryId === selectedCategory;
            const brandMatch = selectedBrand === 'all' || p.brandId === selectedBrand;
            return searchMatch && categoryMatch && brandMatch;
        });
    }, [products, searchTerm, selectedCategory, selectedBrand]);

    const paginatedProducts = useMemo(() => {
        if (showAll) return filteredProducts;
        return filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    }, [filteredProducts, currentPage, showAll]);

    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

    const getStockForWarehouse = (product: Product, warehouseId: string) => {
        return product.stockLevels?.find(sl => sl.warehouseId === warehouseId)?.quantity ?? 0;
    };
    
    const getTotalStock = (product: Product) => {
         return (product.stockLevels || []).reduce((sum, level) => sum + level.quantity, 0);
    }

    const supplierMap = useMemo(() => {
        return new Map(suppliers.map(s => [s.id, s.name]));
    }, [suppliers]);

    const getSupplierName = (id?: string) => (id && supplierMap.get(id)) || 'Inconnu';

    const getBorderColor = (color: string = 'blue') => {
        const colorMap: Record<string, string> = {
            'blue': 'border-blue-500', 'emerald': 'border-emerald-500', 'purple': 'border-purple-500', 
            'orange': 'border-orange-500', 'red': 'border-red-500', 'cyan': 'border-cyan-500', 
            'indigo': 'border-indigo-500', 'rose': 'border-rose-500'
        };
        return colorMap[color] || 'border-blue-500';
    };

    const itemData = useMemo(() => ({
        items: paginatedProducts,
        functions: {
            warehouses,
            getSupplierName,
            getStockForWarehouse,
            getTotalStock,
            getBorderColor
        }
    }), [paginatedProducts, warehouses, supplierMap]);

    const totalPageStockPerWarehouse = useMemo(() => {
        const totals: Record<string, number> = {};
        warehouses.forEach(w => totals[w.id] = 0);
        
        paginatedProducts.forEach(p => {
            warehouses.forEach(w => {
                const qty = getStockForWarehouse(p, w.id);
                totals[w.id] = (totals[w.id] || 0) + qty;
            });
        });
        return totals;
    }, [paginatedProducts, warehouses]);

    const totalPagePhysicalStock = useMemo(() => {
        return paginatedProducts.reduce((sum, p) => sum + getTotalStock(p), 0);
    }, [paginatedProducts]);

    if (loading) return <div className="p-12 text-center text-gray-400 font-black uppercase animate-pulse tracking-widest">Chargement de l'inventaire global...</div>;
    if (error) return <div className="p-8 text-center text-red-500 font-bold bg-red-50 rounded-2xl">{error}</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">État des Stocks</h1>
                    <p className="text-gray-500 text-sm">Vue consolidée de tous les points de stockage.</p>
                </div>
                {hasPermission('inventory:adjustments') && (
                     <button
                        onClick={() => navigate('/inventory/adjustments')}
                        className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-black uppercase text-xs shadow-xl transition-all active:scale-95"
                    >
                        <AdjustmentsIcon className="w-5 h-5 mr-2" />
                        Nouvel ajustement
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input
                        type="text"
                        placeholder="Chercher nom ou SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-none rounded-xl focus:ring-2 focus:ring-primary-500 font-medium"
                    />
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600"
                    >
                        <option value="all">Toutes les catégories</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                     <select
                        value={selectedBrand}
                        onChange={(e) => setSelectedBrand(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600"
                    >
                        <option value="all">Toutes les marques</option>
                        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <button
                        onClick={() => { setShowAll(!showAll); if (!showAll) setCurrentPage(1); }}
                        className={`px-4 py-2 rounded-xl font-bold uppercase text-xs shadow-lg transition-all hover:scale-105 ${showAll ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600'}`}
                    >
                        {showAll ? 'Vue Paginée' : 'Tout afficher'}
                    </button>
                </div>
            </div>

            {showAll ? (
                <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl border border-gray-100 dark:border-gray-700 h-[75vh] flex flex-col">
                    <div className="flex items-center bg-primary-600 text-white px-0 py-4 font-black uppercase text-[10px] tracking-wider sticky top-0 z-10">
                        <div className="px-6 flex-shrink-0 text-left" style={{ width: '250px' }}>Produit / SKU</div>
                        <div className="px-6 flex-shrink-0 text-left" style={{ width: '150px' }}>Fournisseur</div>
                        {warehouses.map(wh => (
                            <div key={wh.id} className={`px-6 flex-shrink-0 text-right border-b-4 ${getBorderColor(wh.color)}`} style={{ width: '100px' }}>
                                {wh.name}
                            </div>
                        ))}
                        <div className="px-6 flex-shrink-0 text-right bg-primary-700" style={{ width: '100px' }}>Total Phys.</div>
                        <div className="px-6 flex-shrink-0 text-right bg-primary-700" style={{ width: '100px' }}>Seuil</div>
                    </div>
                    <div className="flex-1">
                        <AutoSizer>
                            {({ height, width }) => (
                                <List
                                    height={height}
                                    width={width}
                                    itemCount={filteredProducts.length}
                                    itemSize={80}
                                    itemData={itemData}
                                >
                                    {InventoryRow}
                                </List>
                            )}
                        </AutoSizer>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
                        <div className="flex justify-between items-center text-sm font-bold text-gray-500 dark:text-gray-400">
                            <div>{filteredProducts.length} produits</div>
                            <div className="flex items-center gap-4">
                                <span className="uppercase text-xs tracking-wider">Total Stock Physique:</span>
                                <span className="text-lg font-black text-blue-600">{filteredProducts.reduce((sum, p) => sum + getTotalStock(p), 0)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
            <>
            <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-primary-600">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest">Produit / SKU</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest">Fournisseur</th>
                                {warehouses.map(wh => (
                                    <th key={wh.id} className={`px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-widest border-b-4 ${getBorderColor(wh.color)}`}>
                                        {wh.name}
                                    </th>
                                ))}
                                <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-widest bg-primary-700">Total Phys.</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-widest bg-primary-700">Seuil Alerte</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100 dark:bg-gray-800 dark:divide-gray-700">
                            {paginatedProducts.map(product => {
                                const totalStock = getTotalStock(product);
                                const isLowStock = totalStock <= product.minStockAlert;
                                return (
                                    <tr key={product.id} className={`${isLowStock ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'} transition-colors`}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">{product.name}</div>
                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{product.sku}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                                            {getSupplierName(product.supplierId)}
                                        </td>
                                        {warehouses.map(wh => {
                                            const qty = getStockForWarehouse(product, wh.id);
                                            return (
                                                <td key={wh.id} className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${qty <= 0 ? 'text-gray-300' : 'text-gray-700 dark:text-gray-200'}`}>
                                                    {qty}
                                                </td>
                                            );
                                        })}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-gray-900 dark:text-white text-right bg-gray-50/50 dark:bg-gray-900/20">
                                            <span className={isLowStock ? 'text-red-600 animate-pulse' : ''}>{totalStock}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-[10px] text-right font-black text-gray-400 uppercase tracking-widest">
                                            {product.minStockAlert} Unités
                                        </td>
                                    </tr>
                                )
                            })}
                            {paginatedProducts.length === 0 && (
                                <tr><td colSpan={warehouses.length + 3} className="py-24 text-center text-gray-400 font-black uppercase tracking-widest opacity-30">Aucun produit ne correspond à la recherche</td></tr>
                            )}
                        </tbody>
                        <tfoot className="border-t-2 border-gray-200 dark:border-gray-700">
                            <tr className="bg-blue-50 dark:bg-blue-900/20 border-b dark:border-gray-700">
                                <td colSpan={2} className="px-6 py-3 text-right text-xs font-black uppercase text-gray-500">Total Page</td>
                                {warehouses.map(wh => (
                                    <td key={wh.id} className="px-6 py-3 text-right text-sm font-black text-blue-600 dark:text-blue-400">
                                        {totalPageStockPerWarehouse[wh.id]}
                                    </td>
                                ))}
                                <td className="px-6 py-3 text-right text-sm font-black text-gray-900 dark:text-white bg-blue-100 dark:bg-blue-900/40">
                                    {totalPagePhysicalStock}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredProducts.length}
                itemsPerPage={ITEMS_PER_PAGE}
            />
            </>
            )}
        </div>
    );
};

export default InventoryPage;
