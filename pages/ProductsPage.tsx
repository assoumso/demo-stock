
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, deleteDoc, doc, writeBatch, onSnapshot, query, getDocs } from 'firebase/firestore';
import { Product, AppSettings } from '../types';
import * as XLSX from 'xlsx';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../context/DataContext'; // Hook de cache
import Modal from '../components/Modal';

import { Pagination } from '../components/Pagination';
import { PlusIcon, EditIcon, DeleteIcon, DuplicateIcon, ImageIcon, EyeIcon, WarehouseIcon, TrendingUpIcon, SearchIcon, UploadIcon, DownloadIcon, PrintIcon } from '../constants';
import DropdownMenu, { DropdownMenuItem } from '../components/DropdownMenu';
import { formatCurrency } from '../utils/formatters';

const ProductsPage: React.FC = () => {
    const { hasPermission } = useAuth();
    const { categories, brands, units, warehouses, suppliers, products } = useData(); // Données instantanées (products added)
    const navigate = useNavigate();

    // Removed local products state and useEffect fetch
    const [loading, setLoading] = useState(false); // Can be linked to useData loading if desired, but we want instant display if available
    const [error, setError] = useState<string | null>(null);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedBrand, setSelectedBrand] = useState('all');
    const [selectedSupplier, setSelectedSupplier] = useState('all');
    const [selectedWarehouse, setSelectedWarehouse] = useState('all');

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [productToPreview, setProductToPreview] = useState<Product | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    // const [isViewAllModalOpen, setIsViewAllModalOpen] = useState(false); // Removed per user request

    const [showAll, setShowAll] = useState(false);

    // Printing - Now opens in new tab instead of modal
    const handlePrint = () => {
        const params = new URLSearchParams();
        if (searchTerm) params.set('search', searchTerm);
        if (selectedCategory !== 'all') params.set('category', selectedCategory);
        if (selectedBrand !== 'all') params.set('brand', selectedBrand);
        if (selectedSupplier !== 'all') params.set('supplier', selectedSupplier);
        if (selectedWarehouse !== 'all') params.set('warehouse', selectedWarehouse);
        window.open(`/#/products/print?${params.toString()}`, '_blank');
    };

    // Settings
    const [settings, setSettings] = useState<any>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Removed manual fetch useEffect
    
    useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedCategory, selectedBrand, selectedWarehouse, selectedSupplier]);

    // Fetch settings for print
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const settingsSnap = await getDocs(collection(db, "appSettings"));
                if (!settingsSnap.empty) {
                    setSettings({ id: settingsSnap.docs[0].id, ...settingsSnap.docs[0].data() } as AppSettings);
                }
            } catch (error) {
                console.error('Error fetching settings:', error);
            }
        };
        fetchSettings();
    }, []);

    const filteredProducts = useMemo(() => {
        console.log('Filtering products...');
        console.log('Search Term:', searchTerm);
        console.log('Selected Category:', selectedCategory);
        console.log('Selected Brand:', selectedBrand);
        console.log('Selected Warehouse:', selectedWarehouse);
        console.log('Selected Supplier:', selectedSupplier);
        const filtered = products.filter(product => {
            const term = searchTerm.toLowerCase();
            const categoryMatch = selectedCategory === 'all' || product.categoryId === selectedCategory;
            const brandMatch = selectedBrand === 'all' || product.brandId === selectedBrand;
            const supplierMatch = selectedSupplier === 'all' || product.supplierId === selectedSupplier;
            const searchMatch = term === '' || product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term);
            const warehouseMatch = selectedWarehouse === 'all' 
                || (product.stockLevels && product.stockLevels.some(sl => sl.warehouseId === selectedWarehouse));

            console.log(`Product: ${product.name}, SKU: ${product.sku}`);
            console.log(`  Category Match: ${categoryMatch} (Selected: ${selectedCategory}, Product: ${product.categoryId})`);
            console.log(`  Brand Match: ${brandMatch} (Selected: ${selectedBrand}, Product: ${product.brandId})`);
            console.log(`  Supplier Match: ${supplierMatch} (Selected: ${selectedSupplier}, Product: ${product.supplierId})`);
            console.log(`  Search Match: ${searchMatch} (Term: ${term}, Product Name: ${product.name}, SKU: ${product.sku})`);
            console.log(`  Warehouse Match: ${warehouseMatch} (Selected: ${selectedWarehouse}, Product Stock Levels: ${JSON.stringify(product.stockLevels)})`);
            console.log(`  Overall Match: ${categoryMatch && brandMatch && supplierMatch && searchMatch && warehouseMatch}`);

            return categoryMatch && brandMatch && supplierMatch && searchMatch && warehouseMatch;
        });
        console.log('Filtered Products Count:', filtered.length);
        return filtered;
    }, [products, searchTerm, selectedCategory, selectedBrand, selectedWarehouse, selectedSupplier]);

    const paginatedProducts = useMemo(() => {
        if (showAll) return filteredProducts;
        return filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    }, [filteredProducts, currentPage, showAll]);

    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

    const getCategoryName = (id?: string) => categories.find(c => c.id === id)?.name || 'Général';
    const getBrandName = (id?: string) => brands.find(b => b.id === id)?.name || 'Sans Marque';
    const getUnitName = (id?: string) => units.find(u => u.id === id)?.name || 'Unité';
    
    const getDisplayStock = (product: Product) => {
        if (selectedWarehouse === 'all') return (product.stockLevels || []).reduce((sum, level) => sum + level.quantity, 0);
        const stockLevel = (product.stockLevels || []).find(sl => sl.warehouseId === selectedWarehouse);
        return stockLevel ? stockLevel.quantity : 0;
    };

    // Totals Calculation
    const totalGlobalStock = useMemo(() => {
        return filteredProducts.reduce((sum, p) => sum + getDisplayStock(p), 0);
    }, [filteredProducts, selectedWarehouse]);

    const totalGlobalValue = useMemo(() => {
        return filteredProducts.reduce((sum, p) => sum + (getDisplayStock(p) * p.price), 0);
    }, [filteredProducts, selectedWarehouse]);

    const totalPageStock = useMemo(() => {
        return paginatedProducts.reduce((sum, p) => sum + getDisplayStock(p), 0);
    }, [paginatedProducts, selectedWarehouse]);

    const totalPageValue = useMemo(() => {
        return paginatedProducts.reduce((sum, p) => sum + (getDisplayStock(p) * p.price), 0);
    }, [paginatedProducts, selectedWarehouse]);

    const handleDeleteProduct = async () => {
        if (!productToDelete) return;
        try {
            await deleteDoc(doc(db, "products", productToDelete.id));
            setIsDeleteModalOpen(false);
        } catch (err) { setError("Erreur lors de la suppression."); }
    };

    const handleBulkDelete = async () => {
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => batch.delete(doc(db, "products", id)));
            await batch.commit();
            setSelectedIds([]);
            setIsBulkDeleteModalOpen(false);
        } catch (err) { setError("Erreur lors de la suppression groupée."); }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setImportProgress(0);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    alert("Le fichier semble vide.");
                    setIsImporting(false);
                    return;
                }

                // Batch write to Firestore (max 500 ops per batch)
                const batchSize = 450;
                const chunks = [];
                for (let i = 0; i < data.length; i += batchSize) {
                    chunks.push(data.slice(i, i + batchSize));
                }

                let importedCount = 0;

                for (const chunk of chunks) {
                    const batch = writeBatch(db);
                    chunk.forEach((row: any) => {
                        // Skip example row if it looks like the template example
                        if (row['Nom'] === 'Exemple Produit' && row['SKU'] === 'REF-001') return;

                        const newDocRef = doc(collection(db, "products"));
                        const productData: any = {
                            id: newDocRef.id,
                            name: row['Nom'] || row['name'] || 'Produit sans nom',
                            sku: String(row['SKU'] || row['sku'] || newDocRef.id).trim(),
                            type: (row['Type'] || row['type'] || 'product').toLowerCase(),
                            categoryId: row['Categorie ID'] || row['categoryId'] || '', 
                            brandId: row['Marque ID'] || row['brandId'] || '',
                            description: row['Description'] || row['description'] || '',
                            cost: Number(row['Cout'] || row['cost'] || 0),
                            price: Number(row['Prix'] || row['price'] || 0),
                            minStockAlert: Number(row['Alerte Stock'] || row['minStockAlert'] || 5),
                            taxRate: Number(row['Taux Taxe'] || row['taxRate'] || 0),
                            taxInclusive: (row['Taxe Incluse'] && String(row['Taxe Incluse']).toLowerCase() === 'oui') || row['taxInclusive'] === true,
                            stockLevels: []
                        };
                        
                        // Initial stock handling if provided
                        const initialQty = Number(row['Quantite'] || row['quantity'] || 0);
                        if (initialQty > 0 && warehouses.length > 0) {
                             // Default to first warehouse if not specified
                            productData.stockLevels = [{
                                warehouseId: warehouses[0].id,
                                quantity: initialQty
                            }];
                        }

                        batch.set(newDocRef, productData);
                        importedCount++;
                    });
                    await batch.commit();
                    
                    // Update progress based on total processed so far
                    const progress = Math.round((importedCount / data.length) * 100);
                    setImportProgress(progress);
                }

                alert(`${importedCount} produits importés avec succès !`);

            } catch (err) {
                console.error("Erreur lors de l'import Excel:", err);
                setError("Erreur lors de l'import du fichier Excel. Vérifiez le format.");
            } finally {
                setIsImporting(false);
                setImportProgress(0);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleDownloadTemplate = () => {
        const headers = [
            {
                'Nom': 'Exemple Produit',
                'SKU': 'REF-001',
                'Type': 'product',
                'Prix': 15000,
                'Cout': 10000,
                'Quantite': 50,
                'Alerte Stock': 5,
                'Description': 'Description du produit...',
                'Taxe Incluse': 'oui',
                'Taux Taxe': 18
            }
        ];

        const ws = XLSX.utils.json_to_sheet(headers);
        
        // Adjust column widths
        const wscols = [
            {wch: 30}, // Nom
            {wch: 15}, // SKU
            {wch: 10}, // Type
            {wch: 10}, // Prix
            {wch: 10}, // Cout
            {wch: 10}, // Quantite
            {wch: 12}, // Alerte Stock
            {wch: 40}, // Description
            {wch: 12}, // Taxe Incluse
            {wch: 10}  // Taux Taxe
        ];
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Modele");
        XLSX.writeFile(wb, "modele_import_produits.xlsx");
    };

    return (
        <div className="pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Catalogue Articles</h1>
                    <p className="text-gray-500 text-sm">Gérez vos produits et services.</p>
                </div>
                 <div className="flex items-center space-x-2">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept=".xlsx, .xls, .csv" 
                        className="hidden" 
                    />
                    {hasPermission('products:create') && (
                        <>
                            <button 
                                onClick={handleDownloadTemplate} 
                                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold uppercase text-xs shadow-lg transition-all"
                                title="Télécharger le modèle Excel"
                            >
                                <DownloadIcon className="w-5 h-5 mr-2" />
                                Modèle
                            </button>
                            <button 
                                onClick={() => fileInputRef.current?.click()} 
                                disabled={isImporting}
                                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold uppercase text-xs shadow-lg transition-all"
                            >
                                <UploadIcon className="w-5 h-5 mr-2" />
                                {isImporting ? 'Import...' : 'Importer Excel'}
                            </button>
                        </>
                    )}

                    {hasPermission('products:delete') && selectedIds.length > 0 && (
                        <button onClick={() => setIsBulkDeleteModalOpen(true)} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold uppercase text-xs shadow-lg transition-all">
                            <DeleteIcon className="w-5 h-5 mr-2" /> Supprimer ({selectedIds.length})
                        </button>
                    )}
                    <button 
                        onClick={handlePrint} 
                        className="px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-black font-bold uppercase text-xs shadow-lg flex items-center justify-center transition-all hover:scale-105"
                    >
                        <PrintIcon className="w-4 h-4 mr-2" /> Imprimer
                    </button>
                    {hasPermission('products:create') && (
                        <button onClick={() => navigate('/products/new')} className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-black uppercase text-xs shadow-xl transition-all">
                            <PlusIcon className="w-5 h-5 mr-2" /> Ajouter un Article
                        </button>
                    )}
                </div>
            </div>

            <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative">
                        <input type="text" placeholder="Nom ou SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl border-none focus:ring-2 focus:ring-primary-500 font-medium" />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIcon className="w-4 h-4"/></div>
                    </div>
                    <div className="flex items-center">
                         <label className="flex items-center space-x-2 cursor-pointer bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all w-full">
                            <input 
                                type="checkbox" 
                                checked={showAll} 
                                onChange={(e) => setShowAll(e.target.checked)} 
                                className="form-checkbox h-5 w-5 text-primary-600 rounded focus:ring-primary-500 border-gray-300" 
                            />
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase select-none">Tout Afficher</span>
                        </label>
                    </div>
                    <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 font-bold">
                        <option value="all">Toutes catégories</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className="px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 font-bold">
                        <option value="all">Toutes marques</option>
                        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} className="px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 font-bold">
                        <option value="all">Tous fournisseurs</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)} className="px-3 py-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 font-bold">
                        <option value="all">Stock Global</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="p-24 text-center text-gray-400 font-black uppercase tracking-widest animate-pulse">Synchronisation en cours...</div>
            ) : (
                <>
                <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl border border-gray-100 dark:border-gray-700">
                    <div className="overflow-x-auto max-h-[70vh]">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 relative">
                            <thead className="bg-primary-600 text-white sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-4 w-10 text-center"><input type="checkbox" checked={paginatedProducts.length > 0 && selectedIds.length === paginatedProducts.length} onChange={(e) => setSelectedIds(e.target.checked ? paginatedProducts.map(p => p.id) : [])} className="h-4 w-4 rounded cursor-pointer"/></th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase">Aperçu</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase">Article</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase">Catégorie</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase">Prix</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase">Stock</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {paginatedProducts.map(product => (
                                    <tr key={product.id} className={`${selectedIds.includes(product.id) ? 'bg-primary-50 dark:bg-primary-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'} transition-colors`}>
                                        <td className="px-4 py-4 text-center">
                                             <input type="checkbox" checked={selectedIds.includes(product.id)} onChange={() => setSelectedIds(prev => prev.includes(product.id) ? prev.filter(id => id !== product.id) : [...prev, product.id])} className="h-4 w-4 text-primary-600 rounded cursor-pointer"/>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="w-12 h-12 bg-gray-50 dark:bg-gray-900 rounded-xl overflow-hidden border dark:border-gray-700 flex items-center justify-center">
                                                {product.imageUrl ? <img className="w-full h-full object-cover" src={product.imageUrl} alt="" /> : <ImageIcon className="w-6 h-6 text-gray-300" />}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tighter">{product.name}</div>
                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{product.sku}</div>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-black text-primary-600 uppercase">{getCategoryName(product.categoryId)}</td>
                                        <td className="px-6 py-4 text-right font-black">{formatCurrency(product.price)}</td>
                                        <td className="px-6 py-4 text-right">
                                            {product.type === 'service' ? <span className="text-[10px] text-gray-300 font-black italic">Service</span> : (
                                                <div className={`inline-flex px-3 py-1 rounded-xl font-black text-sm ${getDisplayStock(product) <= product.minStockAlert ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-700'}`}>
                                                    {getDisplayStock(product)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuItem onClick={() => { setProductToPreview(product); setIsPreviewModalOpen(true); }}><EyeIcon className="w-4 h-4 mr-3 text-blue-500" /> Fiche</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => navigate(`/products/history/${product.id}`)}><TrendingUpIcon className="w-4 h-4 mr-3 text-purple-500" /> Historique Stock</DropdownMenuItem>
                                                {hasPermission('products:edit') && <DropdownMenuItem onClick={() => navigate(`/products/edit/${product.id}`)}><EditIcon className="w-4 h-4 mr-3" /> Modifier</DropdownMenuItem>}
                                                {hasPermission('products:delete') && <DropdownMenuItem onClick={() => { setProductToDelete(product); setIsDeleteModalOpen(true); }} className="text-red-600 font-bold"><DeleteIcon className="w-4 h-4 mr-3" /> Supprimer</DropdownMenuItem>}
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                                <tr className="border-b dark:border-gray-700">
                                    <td colSpan={4} className="px-6 py-3 text-right text-xs font-black uppercase text-gray-500">Total Page</td>
                                    <td className="px-6 py-3 text-right text-xs font-black text-primary-600">{formatCurrency(totalPageValue)}</td>
                                    <td className="px-6 py-3 text-right text-xs font-black text-gray-700 dark:text-gray-300">{totalPageStock}</td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td colSpan={4} className="px-6 py-3 text-right text-xs font-black uppercase text-primary-600">Total Global</td>
                                    <td className="px-6 py-3 text-right text-xs font-black text-primary-600">{formatCurrency(totalGlobalValue)}</td>
                                    <td className="px-6 py-3 text-right text-xs font-black text-gray-900 dark:text-white">{totalGlobalStock}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filteredProducts.length} itemsPerPage={ITEMS_PER_PAGE} />
                </>
            )}

            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmation">
                <div className="p-6 font-bold text-gray-600">Supprimer définitivement <span className="text-red-600 uppercase">"{productToDelete?.name}"</span> ?</div>
                <div className="p-4 flex flex-row-reverse bg-gray-50 dark:bg-gray-700">
                    <button onClick={handleDeleteProduct} className="px-6 py-2 bg-red-600 text-white rounded-xl font-black uppercase text-xs ml-3">Supprimer</button>
                    <button onClick={() => setIsDeleteModalOpen(false)} className="px-6 py-2 bg-white text-gray-700 rounded-xl font-black uppercase text-xs border">Annuler</button>
                </div>
            </Modal>

            <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} title="Confirmation suppression groupée">
                <div className="p-6 font-bold text-gray-600">Supprimer définitivement <span className="text-red-600 font-black">{selectedIds.length}</span> articles sélectionnés ?</div>
                <div className="p-4 flex flex-row-reverse bg-gray-50 dark:bg-gray-700">
                    <button onClick={handleBulkDelete} className="px-6 py-2 bg-red-600 text-white rounded-xl font-black uppercase text-xs ml-3">Supprimer tout</button>
                    <button onClick={() => setIsBulkDeleteModalOpen(false)} className="px-6 py-2 bg-white text-gray-700 rounded-xl font-black uppercase text-xs border">Annuler</button>
                </div>
            </Modal>

            {isImporting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 border border-gray-100 dark:border-gray-700">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6 animate-pulse">
                                <UploadIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">Importation en cours</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">Veuillez patienter pendant l'traitement de votre fichier...</p>
                            
                            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 mb-4 overflow-hidden">
                                <div 
                                    className="bg-blue-600 h-4 rounded-full transition-all duration-300 ease-out flex items-center justify-center"
                                    style={{ width: `${importProgress}%` }}
                                >
                                    {importProgress > 10 && <span className="text-[8px] font-bold text-white">{importProgress}%</span>}
                                </div>
                            </div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{importProgress}% Complété</p>
                        </div>
                    </div>
                </div>
            )}



            {productToPreview && (
                <Modal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} title="Fiche Article" maxWidth="max-w-4xl">
                    <div className="p-6">
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="w-full md:w-1/3">
                                <div className="aspect-square bg-gray-100 dark:bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center border dark:border-gray-700">
                                    {productToPreview.imageUrl ? (
                                        <img src={productToPreview.imageUrl} alt={productToPreview.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <ImageIcon className="w-20 h-20 text-gray-300" />
                                    )}
                                </div>
                            </div>
                            <div className="w-full md:w-2/3 space-y-4">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{productToPreview.name}</h3>
                                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">SKU: {productToPreview.sku}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                        <div className="text-[10px] uppercase font-black text-gray-400 mb-1">Prix de vente</div>
                                        <div className="text-lg font-black text-primary-600">{formatCurrency(productToPreview.price)}</div>
                                    </div>
                                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                        <div className="text-[10px] uppercase font-black text-gray-400 mb-1">Coût d'achat</div>
                                        <div className="text-lg font-black text-gray-700 dark:text-gray-300">{formatCurrency(productToPreview.costPrice || 0)}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                                    <div className="flex justify-between border-b dark:border-gray-700 py-2">
                                        <span className="text-gray-500 font-medium">Catégorie</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{getCategoryName(productToPreview.categoryId)}</span>
                                    </div>
                                    <div className="flex justify-between border-b dark:border-gray-700 py-2">
                                        <span className="text-gray-500 font-medium">Marque</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{getBrandName(productToPreview.brandId)}</span>
                                    </div>
                                    <div className="flex justify-between border-b dark:border-gray-700 py-2">
                                        <span className="text-gray-500 font-medium">Unité</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{getUnitName(productToPreview.unitId)}</span>
                                    </div>
                                    <div className="flex justify-between border-b dark:border-gray-700 py-2">
                                        <span className="text-gray-500 font-medium">Type</span>
                                        <span className="font-bold text-gray-900 dark:text-white capitalize">{productToPreview.type === 'service' ? 'Service' : 'Produit Stockable'}</span>
                                    </div>
                                </div>

                                {productToPreview.type !== 'service' && (
                                    <div className="mt-6">
                                        <h4 className="text-xs font-black uppercase text-gray-900 dark:text-white mb-3 flex items-center">
                                            <WarehouseIcon className="w-4 h-4 mr-2 text-primary-500" />
                                            État du Stock
                                        </h4>
                                        <div className="space-y-2">
                                            {(productToPreview.stockLevels || []).map(sl => {
                                                const warehouse = warehouses.find(w => w.id === sl.warehouseId);
                                                if (!warehouse) return null;
                                                return (
                                                    <div key={sl.warehouseId} className="flex justify-between items-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/30 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors">
                                                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{warehouse.name}</span>
                                                        <span className={`text-sm font-black ${sl.quantity <= (productToPreview.minStockAlert || 0) ? 'text-red-500' : 'text-green-600'}`}>
                                                            {sl.quantity}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                            {(!productToPreview.stockLevels || productToPreview.stockLevels.length === 0) && (
                                                <div className="text-sm text-gray-400 italic text-center py-2">Aucun stock enregistré</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 flex justify-between items-center">
                        <div className="flex space-x-2">
                             {hasPermission('products:edit') && (
                                <button 
                                    onClick={() => {
                                        setIsPreviewModalOpen(false);
                                        navigate(`/products/edit/${productToPreview.id}`);
                                    }} 
                                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold uppercase text-xs shadow-lg transition-all"
                                >
                                    <EditIcon className="w-4 h-4 mr-2" /> Modifier
                                </button>
                            )}
                            {hasPermission('products:delete') && (
                                <button 
                                    onClick={() => {
                                        setIsPreviewModalOpen(false);
                                        setProductToDelete(productToPreview);
                                        setIsDeleteModalOpen(true);
                                    }} 
                                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold uppercase text-xs shadow-lg transition-all"
                                >
                                    <DeleteIcon className="w-4 h-4 mr-2" /> Supprimer
                                </button>
                            )}
                        </div>
                        <button onClick={() => setIsPreviewModalOpen(false)} className="px-6 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl font-black uppercase text-xs border dark:border-gray-600 shadow-sm hover:shadow-md transition-all">Fermer</button>
                    </div>
                </Modal>
            )}


        </div>
    );
};

export default ProductsPage;
