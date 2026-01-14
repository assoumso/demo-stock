
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { Product, Category, Brand, Unit, Warehouse } from '../types';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { PlusIcon, EditIcon, DeleteIcon, DuplicateIcon, ImageIcon, EyeIcon, WarehouseIcon, WarningIcon, SearchIcon, TrendingUpIcon } from '../constants';
import DropdownMenu, { DropdownMenuItem } from '../components/DropdownMenu';

const ProductsPage: React.FC = () => {
    const { hasPermission } = useAuth();
    const navigate = useNavigate();

    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedBrand, setSelectedBrand] = useState('all');
    const [selectedWarehouse, setSelectedWarehouse] = useState('all');

    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
    
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [productToPreview, setProductToPreview] = useState<Product | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [productsSnapshot, categoriesSnapshot, brandsSnapshot, unitsSnapshot, warehousesSnapshot] = await Promise.all([
                getDocs(collection(db, "products")),
                getDocs(collection(db, "categories")),
                getDocs(collection(db, "brands")),
                getDocs(collection(db, "units")),
                getDocs(collection(db, "warehouses"))
            ]);
            setProducts(productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
            setCategories(categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
            setBrands(brandsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)));
            setUnits(unitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));
            setWarehouses(warehousesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
        } catch (err) {
            console.error("Error fetching products data:", err);
            setError("Impossible de charger les données des produits.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedCategory, selectedBrand, selectedWarehouse]);

    useEffect(() => {
        setSelectedIds([]);
    }, [currentPage]);

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const term = searchTerm.toLowerCase();
            const categoryMatch = selectedCategory === 'all' || product.categoryId === selectedCategory;
            const brandMatch = selectedBrand === 'all' || product.brandId === selectedBrand;
            const searchMatch = term === '' || product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term);
            const warehouseMatch = selectedWarehouse === 'all' 
                || (product.stockLevels && product.stockLevels.some(sl => sl.warehouseId === selectedWarehouse));

            return categoryMatch && brandMatch && searchMatch && warehouseMatch;
        });
    }, [products, searchTerm, selectedCategory, selectedBrand, selectedWarehouse]);

    const paginatedProducts = useMemo(() => {
        return filteredProducts.slice(
            (currentPage - 1) * ITEMS_PER_PAGE,
            currentPage * ITEMS_PER_PAGE
        );
    }, [filteredProducts, currentPage]);

    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

    const getCategoryName = (id?: string) => categories.find(c => c.id === id)?.name || 'Général';
    const getBrandName = (id?: string) => brands.find(b => b.id === id)?.name || 'Sans Marque';
    const getUnitName = (id?: string) => units.find(u => u.id === id)?.name || 'Unité';
    const getWarehouseName = (id: string) => warehouses.find(w => w.id === id)?.name || 'Inconnu';
    
    const getDisplayStock = (product: Product) => {
        if (selectedWarehouse === 'all') {
            return (product.stockLevels || []).reduce((sum, level) => sum + level.quantity, 0);
        }
        return (product.stockLevels || []).find(sl => sl.warehouseId === selectedWarehouse)?.quantity || 0;
    };

    const openDeleteModal = (product: Product) => {
        setProductToDelete(product);
        setIsDeleteModalOpen(true);
    };

    const openPreviewModal = (product: Product) => {
        setProductToPreview(product);
        setIsPreviewModalOpen(true);
    };

    const handleDeleteProduct = async () => {
        if (!productToDelete) return;
        try {
            await deleteDoc(doc(db, "products", productToDelete.id));
            setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
            setProductToDelete(null);
            setIsDeleteModalOpen(false);
        } catch (err) {
            setError("Erreur lors de la suppression du produit.");
        }
    };

    const handleDuplicateProduct = (product: Product) => {
        const { id, sku, ...productToDuplicate } = product;
        const newSku = `${sku}-COPY-${Date.now().toString().slice(-4)}`;
        navigate('/products/new', { state: { productToDuplicate: { ...productToDuplicate, sku: newSku } } });
    };

    const handleSelectOne = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const pageIds = paginatedProducts.map(p => p.id);
            setSelectedIds(pageIds);
        } else {
            setSelectedIds([]);
        }
    };
    
    const handleBulkDelete = async () => {
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                batch.delete(doc(db, "products", id));
            });
            await batch.commit();
            setProducts(prev => prev.filter(p => !selectedIds.includes(p.id)));
            setSelectedIds([]);
            setIsBulkDeleteModalOpen(false);
        } catch (err) {
            setError("Erreur lors de la suppression groupée.");
        }
    };

    const formatCurrency = (value: number) => new Intl.NumberFormat('fr-FR').format(value) + ' FCFA';

    const areAllOnPageSelected = paginatedProducts.length > 0 && selectedIds.length === paginatedProducts.length;

    return (
        <div className="pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Catalogue Articles</h1>
                    <p className="text-gray-500 text-sm">Gérez vos produits physiques et vos prestations de services.</p>
                </div>
                 <div className="flex items-center space-x-2">
                    {hasPermission('products:delete') && selectedIds.length > 0 && (
                        <button
                            onClick={() => setIsBulkDeleteModalOpen(true)}
                            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold uppercase text-xs transition-all shadow-lg"
                        >
                            <DeleteIcon className="w-5 h-5 mr-2" />
                            Supprimer ({selectedIds.length})
                        </button>
                    )}
                    {hasPermission('products:create') && (
                        <button
                            onClick={() => navigate('/products/new')}
                            className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-black uppercase text-xs shadow-xl transition-all hover:scale-[1.02] active:scale-95"
                        >
                            <PlusIcon className="w-5 h-5 mr-2" />
                            Ajouter un Article
                        </button>
                    )}
                </div>
            </div>

            {/* Filtres de recherche */}
            <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Nom ou SKU..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl border-none focus:ring-2 focus:ring-primary-500 font-medium"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIcon className="w-4 h-4"/></div>
                    </div>
                    <div>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600"
                        >
                            <option value="all">Toutes catégories</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="w-full px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600"
                        >
                            <option value="all">Toutes marques</option>
                            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <select
                            value={selectedWarehouse}
                            onChange={(e) => setSelectedWarehouse(e.target.value)}
                            className="w-full px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600"
                        >
                            <option value="all">Stock Global</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="p-24 text-center text-gray-400 font-black uppercase tracking-widest animate-pulse">Chargement du catalogue...</div>
            ) : error ? (
                <p className="text-red-500 font-bold text-center p-8 bg-red-50 rounded-2xl">{error}</p>
            ) : (
                <>
                <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-primary-600">
                                <tr>
                                    <th className="px-4 py-4 w-10 text-center">
                                        <input type="checkbox"
                                            className="h-4 w-4 text-primary-900 border-white rounded focus:ring-0 cursor-pointer"
                                            checked={areAllOnPageSelected}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest">Aperçu</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest">Identité Article</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-white uppercase tracking-widest">Catégorie / Marque</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-widest">Prix Vente</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-widest">Stock</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black text-white uppercase tracking-widest">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {paginatedProducts.map(product => (
                                    <tr key={product.id} className={`${selectedIds.includes(product.id) ? 'bg-primary-50 dark:bg-primary-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'} transition-colors`}>
                                        <td className="px-4 py-4 text-center">
                                             <input type="checkbox"
                                                className="h-4 w-4 text-primary-600 rounded cursor-pointer"
                                                checked={selectedIds.includes(product.id)}
                                                onChange={() => handleSelectOne(product.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="w-12 h-12 flex-shrink-0 bg-gray-50 dark:bg-gray-900 rounded-xl overflow-hidden border dark:border-gray-700 flex items-center justify-center">
                                                {product.imageUrl ? (
                                                    <img className="w-full h-full object-cover" src={product.imageUrl} alt={product.name} />
                                                ) : (
                                                    <ImageIcon className="w-6 h-6 text-gray-300" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tighter">{product.name}</div>
                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center mt-1">
                                                <span className={`w-2 h-2 rounded-full mr-2 ${product.type === 'service' ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                                                {product.sku}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-gray-500 dark:text-gray-400">
                                            <div className="font-black text-primary-600 uppercase">{getCategoryName(product.categoryId)}</div>
                                            <div className="uppercase mt-0.5">{getBrandName(product.brandId)}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(product.price)}</div>
                                            <div className="text-[9px] font-bold text-gray-400 uppercase">HT / {getUnitName(product.unitId)}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {product.type === 'service' ? (
                                                <span className="text-[10px] text-gray-300 uppercase font-black italic">Service</span>
                                            ) : (
                                                <div className={`inline-flex flex-col items-end px-3 py-1 rounded-xl ${getDisplayStock(product) <= product.minStockAlert ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-gray-50 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300'}`}>
                                                    <span className="text-sm font-black">{getDisplayStock(product)}</span>
                                                    {getDisplayStock(product) <= product.minStockAlert && <span className="text-[8px] font-black uppercase animate-pulse">Alerte</span>}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuItem onClick={() => openPreviewModal(product)}>
                                                    <EyeIcon className="w-4 h-4 mr-3 text-blue-500" /> Aperçu détaillé
                                                </DropdownMenuItem>
                                                {hasPermission('products:edit') && (
                                                    <DropdownMenuItem onClick={() => navigate(`/products/edit/${product.id}`)}>
                                                        <EditIcon className="w-4 h-4 mr-3" /> Modifier
                                                    </DropdownMenuItem>
                                                )}
                                                {hasPermission('products:create') && (
                                                    <DropdownMenuItem onClick={() => handleDuplicateProduct(product)}>
                                                        <DuplicateIcon className="w-4 h-4 mr-3 text-purple-500" /> Dupliquer
                                                    </DropdownMenuItem>
                                                )}
                                                <div className="border-t dark:border-gray-700 my-1"></div>
                                                {hasPermission('products:delete') && (
                                                    <DropdownMenuItem onClick={() => openDeleteModal(product)} className="text-red-600 font-bold">
                                                        <DeleteIcon className="w-4 h-4 mr-3" /> Supprimer
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))}
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
                </>
            )}

            {/* Modal de suppression individuelle */}
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmation">
                <div className="p-6">
                    <p className="text-sm font-bold text-gray-600">Supprimer définitivement l'article <span className="text-red-600 uppercase">"{productToDelete?.name}"</span> ?</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button onClick={handleDeleteProduct} className="w-full inline-flex justify-center rounded-xl px-6 py-2 bg-red-600 text-xs font-black text-white hover:bg-red-700 sm:ml-3 sm:w-auto uppercase tracking-widest transition-all">Supprimer</button>
                    <button onClick={() => setIsDeleteModalOpen(false)} className="mt-3 w-full inline-flex justify-center rounded-xl px-6 py-2 bg-white text-xs font-black text-gray-700 hover:bg-gray-50 sm:mt-0 sm:w-auto uppercase tracking-widest border transition-all">Annuler</button>
                </div>
            </Modal>
            
            {/* Modal de suppression groupée */}
            <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} title="Suppression Groupée">
                <div className="p-6">
                    <p className="text-sm font-bold text-gray-600">Supprimer les {selectedIds.length} articles sélectionnés ? Cette action est irréversible.</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button onClick={handleBulkDelete} className="w-full inline-flex justify-center rounded-xl px-6 py-2 bg-red-600 text-xs font-black text-white hover:bg-red-700 sm:ml-3 sm:w-auto uppercase tracking-widest transition-all">Tout supprimer</button>
                    <button onClick={() => setIsBulkDeleteModalOpen(false)} className="mt-3 w-full inline-flex justify-center rounded-xl px-6 py-2 bg-white text-xs font-black text-gray-700 hover:bg-gray-50 sm:mt-0 sm:w-auto uppercase tracking-widest border transition-all">Annuler</button>
                </div>
            </Modal>

            {/* MODAL D'APERÇU DÉTAILLÉ (OPTIMISÉ) */}
            <Modal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} title="Fiche Produit Détaillée" maxWidth="max-w-3xl">
                {productToPreview && (
                    <div className="p-0 flex flex-col max-h-[85vh]">
                        {/* Header HERO */}
                        <div className="bg-gray-900 text-white p-8 relative overflow-hidden">
                            <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
                                <div className="w-32 h-32 md:w-40 md:h-40 bg-white rounded-3xl shadow-2xl p-2 flex-shrink-0 flex items-center justify-center border-4 border-gray-800">
                                    {productToPreview.imageUrl ? (
                                        <img src={productToPreview.imageUrl} alt={productToPreview.name} className="w-full h-full object-contain rounded-2xl" />
                                    ) : (
                                        <ImageIcon className="w-16 h-16 text-gray-200" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${productToPreview.type === 'service' ? 'bg-blue-600' : 'bg-green-600'}`}>
                                            {productToPreview.type === 'service' ? 'Service' : 'Produit Physique'}
                                        </span>
                                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-gray-700 border border-gray-600">SKU: {productToPreview.sku}</span>
                                    </div>
                                    <h3 className="text-3xl font-black uppercase leading-tight tracking-tighter mb-2">{productToPreview.name}</h3>
                                    <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">{getCategoryName(productToPreview.categoryId)} • {getBrandName(productToPreview.brandId)}</p>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 opacity-10 translate-x-1/4 -translate-y-1/4 pointer-events-none">
                                <PlusIcon className="w-64 h-64" />
                            </div>
                        </div>

                        {/* Contenu Scrollable */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-10">
                            
                            {/* Grille des Stats Financières */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <div className="bg-primary-50 dark:bg-primary-900/20 p-5 rounded-3xl border border-primary-100 dark:border-primary-800">
                                    <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-1">Prix de Vente HT</p>
                                    <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(productToPreview.price)}</p>
                                    <p className="text-[10px] font-bold text-primary-400 uppercase mt-1">Par {getUnitName(productToPreview.unitId)}</p>
                                </div>
                                {productToPreview.type !== 'service' && hasPermission('reports:profit') && (
                                    <>
                                    <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Coût d'Achat</p>
                                        <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(productToPreview.cost)}</p>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">Dernière Entrée</p>
                                    </div>
                                    <div className="bg-green-50 dark:bg-green-900/20 p-5 rounded-3xl border border-green-100 dark:border-green-800">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Marge Brute</p>
                                            <TrendingUpIcon className="w-4 h-4 text-green-600" />
                                        </div>
                                        <p className="text-2xl font-black text-green-700 dark:text-green-400">{formatCurrency(productToPreview.price - productToPreview.cost)}</p>
                                        <p className="text-[10px] font-bold text-green-600 uppercase mt-1">{(((productToPreview.price - productToPreview.cost) / productToPreview.price) * 100).toFixed(1)}% de marge</p>
                                    </div>
                                    </>
                                )}
                            </div>

                            {/* Section des Stocks (Cartes Visuelles) */}
                            {productToPreview.type !== 'service' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center">
                                            <WarehouseIcon className="w-5 h-5 mr-3 text-primary-500" /> État des Stocks par Site
                                        </h4>
                                        <div className="flex items-center bg-red-50 dark:bg-red-900/20 px-4 py-1.5 rounded-full border border-red-100 dark:border-red-900/40">
                                            <span className="text-[10px] font-black text-red-600 uppercase tracking-tighter">Alerte : {productToPreview.minStockAlert} {getUnitName(productToPreview.unitId)}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {warehouses.map(wh => {
                                            const level = productToPreview.stockLevels?.find(sl => sl.warehouseId === wh.id)?.quantity || 0;
                                            const isLow = level <= (productToPreview.minStockAlert / 2);
                                            const isWarning = level > (productToPreview.minStockAlert / 2) && level <= productToPreview.minStockAlert;
                                            
                                            return (
                                                <div key={wh.id} className="p-4 rounded-2xl border dark:border-gray-700 bg-white dark:bg-gray-900/40 shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase truncate pr-4">{wh.name}</span>
                                                        <span className={`text-sm font-black ${isLow ? 'text-red-600' : isWarning ? 'text-orange-500' : 'text-green-600'}`}>{level}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full transition-all duration-1000 ${isLow ? 'bg-red-600' : isWarning ? 'bg-orange-500' : 'bg-green-500'}`}
                                                            style={{ width: `${Math.min((level / (productToPreview.minStockAlert * 3)) * 100, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                    <div className="flex justify-between mt-2">
                                                        <span className="text-[9px] font-black text-gray-400 uppercase">{isLow ? 'Critique' : isWarning ? 'Limite' : 'Optimal'}</span>
                                                        <span className="text-[9px] font-black text-gray-400 uppercase">{level} {getUnitName(productToPreview.unitId)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Totalisateur de Stock */}
                                    <div className="bg-gray-900 dark:bg-primary-600 text-white p-6 rounded-3xl flex flex-col md:flex-row justify-between items-center shadow-xl">
                                        <div className="text-center md:text-left mb-4 md:mb-0">
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Disponibilité Totale</p>
                                            <h5 className="text-3xl font-black uppercase tracking-tighter">
                                                {productToPreview.stockLevels?.reduce((sum, sl) => sum + sl.quantity, 0)} {getUnitName(productToPreview.unitId)}S
                                            </h5>
                                        </div>
                                        <div className="px-6 py-3 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-md">
                                            <p className="text-[10px] font-black uppercase text-center">Valeur Actuelle du Stock (Coût)</p>
                                            <p className="text-xl font-black">{formatCurrency((productToPreview.stockLevels?.reduce((sum, sl) => sum + sl.quantity, 0) || 0) * productToPreview.cost)}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Description Section */}
                            {productToPreview.description && (
                                <div className="border-t dark:border-gray-700 pt-8">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Notes & Description</h4>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl text-sm text-gray-600 dark:text-gray-400 leading-relaxed italic border border-dashed dark:border-gray-700">
                                        {productToPreview.description}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer avec actions rapides */}
                        <div className="bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => { setIsPreviewModalOpen(false); navigate(`/products/edit/${productToPreview.id}`); }}
                                    className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-primary-700 transition-all"
                                >
                                    Modifier l'Article
                                </button>
                                <button 
                                    onClick={() => { setIsPreviewModalOpen(false); handleDuplicateProduct(productToPreview); }}
                                    className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-black text-[10px] uppercase tracking-widest border dark:border-gray-600 hover:bg-gray-200 transition-all"
                                >
                                    Dupliquer
                                </button>
                            </div>
                            <button 
                                onClick={() => setIsPreviewModalOpen(false)}
                                className="w-full sm:w-auto px-10 py-2.5 bg-gray-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
                            >
                                Fermer la Fiche
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default ProductsPage;
