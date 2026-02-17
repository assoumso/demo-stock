import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Product, Category, Brand, Supplier, AppSettings } from '../types';
import { ProductListPrint } from '../components/ProductListPrint';
import { useReactToPrint } from 'react-to-print';

const ProductPrintPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasPrinted, setHasPrinted] = useState(false);
    const printRef = React.useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: 'Liste des Produits',
        onAfterPrint: () => {
            // Ne pas fermer automatiquement pour l'instant
            console.log('Impression terminée');
        }
    });

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                
                // Récupérer les paramètres de filtre depuis l'URL
                const categoryFilter = searchParams.get('category');
                const brandFilter = searchParams.get('brand');
                const supplierFilter = searchParams.get('supplier');
                const warehouseFilter = searchParams.get('warehouse');
                const searchTerm = searchParams.get('search');
                const lowStock = searchParams.get('lowStock') === 'true';
                const outOfStock = searchParams.get('outOfStock') === 'true';

                // Charger les données
                const [productsSnap, categoriesSnap, brandsSnap, suppliersSnap, settingsSnap] = await Promise.all([
                    getDocs(collection(db, 'products')),
                    getDocs(collection(db, 'categories')),
                    getDocs(collection(db, 'brands')),
                    getDocs(collection(db, 'suppliers')),
                    getDoc(doc(db, 'settings', 'app-config'))
                ]);

                const productsData = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
                const categoriesData = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
                const brandsData = brandsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand));
                const suppliersData = suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));

                setCategories(categoriesData);
                setBrands(brandsData);
                setSuppliers(suppliersData);

                if (settingsSnap.exists()) {
                    setSettings(settingsSnap.data() as AppSettings);
                }

                // Filtrer les produits selon les paramètres
                let filteredProducts = productsData;

                if (searchTerm) {
                    filteredProducts = filteredProducts.filter(product =>
                        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        product.sku.toLowerCase().includes(searchTerm.toLowerCase())
                    );
                }

                if (categoryFilter && categoryFilter !== 'all') {
                    filteredProducts = filteredProducts.filter(product => product.categoryId === categoryFilter);
                }

                if (brandFilter && brandFilter !== 'all') {
                    filteredProducts = filteredProducts.filter(product => product.brandId === brandFilter);
                }

                if (supplierFilter && supplierFilter !== 'all') {
                    filteredProducts = filteredProducts.filter(product => product.supplierId === supplierFilter);
                }

                if (lowStock) {
                    filteredProducts = filteredProducts.filter(product => {
                        const totalStock = (product.stockLevels || []).reduce((sum, sl) => sum + sl.quantity, 0);
                        return totalStock <= (product.minStockLevel || 0) && totalStock > 0;
                    });
                }

                if (outOfStock) {
                    filteredProducts = filteredProducts.filter(product => {
                        const totalStock = (product.stockLevels || []).reduce((sum, sl) => sum + sl.quantity, 0);
                        return totalStock === 0;
                    });
                }

                setProducts(filteredProducts);
                setLoading(false);

            } catch (error) {
                console.error('Erreur lors du chargement des données:', error);
                setLoading(false);
            }
        };

        loadData();
    }, [searchParams]);

    // Impression automatique après le chargement et le rendu
    useEffect(() => {
        if (!loading && products.length > 0 && !hasPrinted) {
            const timer = setTimeout(() => {
                handlePrint();
                setHasPrinted(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [loading, products.length, hasPrinted, handlePrint]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Chargement des données pour l'impression...</p>
                </div>
            </div>
        );
    }

    if (products.length === 0) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100">
                <div className="text-center bg-white p-8 rounded-xl shadow-lg">
                    <p className="text-xl font-bold text-gray-800 mb-2">Aucun produit trouvé</p>
                    <p className="text-gray-600 mb-4">Aucun produit ne correspond aux critères sélectionnés.</p>
                    <button 
                        onClick={() => window.close()}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white min-h-screen">
            {/* Bouton de fermeture visible */}
            <div className="fixed top-4 right-4 z-50 print:hidden">
                <button 
                    onClick={() => window.close()}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors shadow-lg"
                >
                    Fermer
                </button>
            </div>
            <div className="flex justify-center">
                <ProductListPrint 
                    ref={printRef}
                    products={products}
                    settings={settings}
                    categories={categories}
                    brands={brands}
                    suppliers={suppliers}
                    filters={{
                        category: searchParams.get('category') || undefined,
                        brand: searchParams.get('brand') || undefined,
                        supplier: searchParams.get('supplier') || undefined,
                        warehouse: searchParams.get('warehouse') || undefined
                    }}
                />
            </div>
        </div>
    );
};

export default ProductPrintPage;