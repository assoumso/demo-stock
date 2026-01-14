
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Product, Warehouse, Category, Brand } from '../types';
import { Pagination } from '../components/Pagination';
import { AdjustmentsIcon } from '../constants';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const InventoryPage: React.FC = () => {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedBrand, setSelectedBrand] = useState('all');

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [productsSnap, warehousesSnap, categoriesSnap, brandsSnap] = await Promise.all([
                    getDocs(collection(db, "products")),
                    getDocs(collection(db, "warehouses")),
                    getDocs(collection(db, "categories")),
                    getDocs(collection(db, "brands")),
                ]);
                setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
                setWarehouses(warehousesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
                setCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
                setBrands(brandsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)));
            } catch (err) {
                setError("Impossible de charger les données de stock.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);
    
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
        return filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    }, [filteredProducts, currentPage]);

    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

    const getStockForWarehouse = (product: Product, warehouseId: string) => {
        return product.stockLevels?.find(sl => sl.warehouseId === warehouseId)?.quantity ?? 0;
    };
    
    const getTotalStock = (product: Product) => {
         return (product.stockLevels || []).reduce((sum, level) => sum + level.quantity, 0);
    }

    const getBorderColor = (color: string = 'blue') => {
        const colorMap: Record<string, string> = {
            'blue': 'border-blue-500', 'emerald': 'border-emerald-500', 'purple': 'border-purple-500', 
            'orange': 'border-orange-500', 'red': 'border-red-500', 'cyan': 'border-cyan-500', 
            'indigo': 'border-indigo-500', 'rose': 'border-rose-500'
        };
        return colorMap[color] || 'border-blue-500';
    };

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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-primary-600">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest">Produit / SKU</th>
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
        </div>
    );
};

export default InventoryPage;
