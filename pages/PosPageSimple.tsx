import React, { useState, useEffect, useMemo } from 'react';
import { Product, Category, Customer, Warehouse, Sale, SaleItem, AppSettings, PaymentMethod } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../context/DataContext';
import Modal from '../components/Modal';
import { SearchIcon, DeleteIcon, WarningIcon, UserAddIcon, XIcon } from '../constants';
import { useReactToPrint } from 'react-to-print';
import PosReceipt from '../components/PosReceipt';
import { formatCurrency } from '../utils/formatters';

interface CartItem extends SaleItem {
    product?: Product;
}

interface PosProductCardProps {
    product: Product;
    onAddToCart: (product: Product) => void;
    inCart: number;
    stock: number;
}

const PosProductCard: React.FC<PosProductCardProps> = ({ product, onAddToCart, inCart, stock }) => {
    const isOutOfStock = stock <= 0;
    
    return (
        <div 
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 cursor-pointer transition-all hover:shadow-lg ${
                isOutOfStock ? 'opacity-50' : 'hover:scale-105'
            }`}
            onClick={() => !isOutOfStock && onAddToCart(product)}
        >
            <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg mb-3 flex items-center justify-center">
                <span className="text-2xl">📦</span>
            </div>
            <h3 className="font-bold text-sm mb-1 text-gray-800 dark:text-white line-clamp-2">
                {product.name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                SKU: {product.sku}
            </p>
            <div className="flex justify-between items-center">
                <span className="font-bold text-lg text-primary-600">
                    {formatCurrency(product.price)}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${
                    isOutOfStock 
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : stock <= 10 
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                }`}>
                    {isOutOfStock ? 'Rupture' : `${stock} unités`}
                </span>
            </div>
            {inCart > 0 && (
                <div className="mt-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded">
                    Dans le panier: {inCart}
                </div>
            )}
        </div>
    );
};

const PosPageSimple: React.FC = () => {
    const { user } = useAuth();
    const { 
        products, 
        categories, 
        customers, 
        warehouses, 
        settings, 
        loading: contextLoading,
        productsLoading,
        refreshData 
    } = useData();

    // UI State
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // POS State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

    // Debug logs
    useEffect(() => {
        console.log('=== POS SIMPLE DATA CHECK ===');
        console.log('Products loaded:', products?.length || 0);
        console.log('Categories loaded:', categories?.length || 0);
        console.log('Products loading state:', productsLoading);
        console.log('Context loading state:', contextLoading);
        
        if (products && products.length > 0) {
            console.log('First product sample:', products[0]);
            console.log('Product properties:', Object.keys(products[0]));
        }
    }, [products, categories, productsLoading, contextLoading]);

    // Filtered products
    const filteredProducts = useMemo(() => {
        console.log('=== SIMPLE FILTER DEBUG ===');
        console.log('Total products:', products.length);
        console.log('Search term:', searchTerm);
        console.log('Selected category:', selectedCategory);
        console.log('Categories available:', categories.length);
        
        const filtered = products.filter(p => {
            if (!p || !p.name || !p.sku) {
                console.warn('Produit invalide trouvé:', p);
                return false;
            }
            
            const searchMatch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              p.sku.toLowerCase().includes(searchTerm.toLowerCase());
            const categoryMatch = selectedCategory === 'all' || (p.categoryId && p.categoryId === selectedCategory);
            
            return searchMatch && categoryMatch;
        });
        
        console.log('Filtered products:', filtered.length);
        return filtered;
    }, [products, searchTerm, selectedCategory, categories]);

    // Cart calculations
    const cartMap = useMemo(() => {
        const map = new Map<string, number>();
        cart.forEach(item => map.set(item.productId, item.quantity));
        return map;
    }, [cart]);

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Stock function
    const getStock = (productId: string) => {
        return 100; // Stock mocké pour le test
    };

    const addToCart = (product: Product) => {
        const existingItem = cart.find(item => item.productId === product.id);
        if (existingItem) {
            setCart(cart.map(item => 
                item.productId === product.id 
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, {
                productId: product.id,
                productName: product.name,
                quantity: 1,
                price: product.price,
                subtotal: product.price,
                product: product
            }]);
        }
    };

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity <= 0) {
            setCart(cart.filter(item => item.productId !== productId));
        } else {
            setCart(cart.map(item => 
                item.productId === productId 
                    ? { ...item, quantity, subtotal: item.price * quantity }
                    : item
            ));
        }
    };

    if (contextLoading || productsLoading) {
        return <div className="p-12 text-center animate-pulse uppercase font-black text-gray-400">Chargement...</div>;
    }

    if (error) {
        return <div className="p-12 text-center text-red-500 font-semibold">Erreur: {error}</div>;
    }

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-100 dark:bg-gray-900">
            {/* Main Content - Products */}
            <div className="flex-1 flex flex-col h-full overflow-hidden p-4">
                <div className="flex-shrink-0 bg-gray-100 dark:bg-gray-900 z-10 py-2">
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                        <div className="relative flex-grow">
                            <input
                                type="text"
                                placeholder="Rechercher des produits..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-12 py-2 border rounded-full dark:bg-gray-800 dark:border-gray-700"
                            />
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <XIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pb-2">
                        <button 
                            onClick={() => setSelectedCategory('all')} 
                            className={`px-3 py-1 text-sm font-bold rounded-full ${
                                selectedCategory === 'all' 
                                    ? 'bg-primary-600 text-white' 
                                    : 'bg-white dark:bg-gray-700'
                            }`}
                        >
                            Toutes
                        </button>
                        {categories.map(cat => (
                            <button 
                                key={cat.id} 
                                onClick={() => setSelectedCategory(cat.id)} 
                                className={`px-3 py-1 text-sm font-bold rounded-full ${
                                    selectedCategory === cat.id 
                                        ? 'bg-primary-600 text-white' 
                                        : 'bg-white dark:bg-gray-700'
                                }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                        <div className="ml-auto text-xs text-gray-500 font-mono">
                            {filteredProducts.length}/{products.length} produits
                        </div>
                    </div>
                </div>

                {/* Products Grid */}
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {filteredProducts.map(product => (
                            <PosProductCard
                                key={product.id}
                                product={product}
                                onAddToCart={addToCart}
                                inCart={cartMap.get(product.id) || 0}
                                stock={getStock(product.id)}
                            />
                        ))}
                    </div>
                    
                    {filteredProducts.length === 0 && (
                        <div className="flex items-center justify-center h-64 text-gray-500">
                            <div className="text-center">
                                <p className="text-lg font-semibold">Aucun produit trouvé</p>
                                <p className="text-sm">Essayez de modifier vos filtres de recherche</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar - Cart */}
            <div className="w-96 bg-white dark:bg-gray-800 shadow-xl flex flex-col border-l dark:border-gray-700">
                <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <h2 className="text-xl font-black uppercase tracking-widest text-gray-800 dark:text-white flex items-center gap-2">
                        <span>🛒</span> Panier
                    </h2>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                    {cart.length === 0 ? (
                        <div className="text-center text-gray-500 mt-8">
                            <p className="text-lg font-semibold">Panier vide</p>
                            <p className="text-sm">Ajoutez des produits pour commencer</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {cart.map(item => (
                                <div key={item.productId} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-semibold text-sm text-gray-800 dark:text-white">
                                            {item.product?.name || 'Produit'}
                                        </h4>
                                        <button
                                            onClick={() => updateQuantity(item.productId, 0)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <DeleteIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                                className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm"
                                            >
                                                -
                                            </button>
                                            <span className="font-semibold">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                                className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <span className="font-bold text-primary-600">
                                            {formatCurrency(item.price * item.quantity)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {cart.length > 0 && (
                    <div className="border-t dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-lg font-bold">Total:</span>
                            <span className="text-xl font-bold text-primary-600">
                                {formatCurrency(cartTotal)}
                            </span>
                        </div>
                        <button className="w-full bg-primary-600 text-white py-3 rounded-lg font-bold hover:bg-primary-700 transition-colors">
                            Valider la vente
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PosPageSimple;