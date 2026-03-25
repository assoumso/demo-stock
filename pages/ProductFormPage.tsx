import React, { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import { Product, Category, Brand, Unit, Warehouse, AppSettings, Supplier } from '../types';
import { ImageIcon } from '../constants';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'; // Import du hook
import { useData } from '../context/DataContext';

const ProductFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    const { categories, brands, units, suppliers, warehouses, settings, loading: dataLoading, refreshData } = useData();

    const [formState, setFormState] = useState<Partial<Product>>({ type: 'product' }); // Default to product
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    // Scanner
    useBarcodeScanner({
        onScan: (barcode) => {
            console.log("Scanned barcode (Product Form):", barcode);
            setFormState(prev => ({ ...prev, sku: barcode }));
        },
        minLength: 3
    });

    const isEditing = !!id;

    useEffect(() => {
        const initForm = async () => {
            if (dataLoading) return; // Wait for global data

            try {
                const initialStockLevels = warehouses.map(wh => ({ warehouseId: wh.id, quantity: 0 }));

                if (location.state?.productToDuplicate) {
                    const productToDuplicate = location.state.productToDuplicate;
                     setFormState({
                        ...productToDuplicate,
                        stockLevels: warehouses.map(wh => {
                            const existingLevel = (productToDuplicate.stockLevels || []).find((sl: any) => sl.warehouseId === wh.id);
                            return { warehouseId: wh.id, quantity: existingLevel?.quantity || 0 };
                        })
                    });
                    if (productToDuplicate.imageUrl) {
                        setImagePreview(productToDuplicate.imageUrl);
                    }
                    setLoading(false);
                } else if (isEditing) {
                    if (!id) return;
                    setLoading(true);
                    
                    const { data: productData, error } = await supabase
                        .from('products')
                        .select('*')
                        .eq('id', id)
                        .single();

                    if (productData && !error) {
                        const newFormState = {
                            ...(productData as Product),
                            categoryId: productData.categoryId || (categories.length > 0 ? categories[0].id : ''),
                            brandId: productData.brandId || (brands.length > 0 ? brands[0].id : ''),
                            unitId: productData.unitId || (units.length > 0 ? units[0].id : ''),
                            stockLevels: warehouses.map(wh => {
                                const existingLevel = (productData.stockLevels || []).find((sl: any) => sl.warehouseId === wh.id);
                                return existingLevel || { warehouseId: wh.id, quantity: 0 };
                            })
                        };
                        
                        setFormState(newFormState);

                        if (productData.imageUrl) {
                            setImagePreview(productData.imageUrl);
                        }
                    } else {
                        setError("Produit non trouvé.");
                        console.error("Error fetching product:", error);
                    }
                    setLoading(false);
                } else {
                     // New product
                     setFormState({
                        type: 'product', // Default type
                        name: '', sku: '', imageUrl: '', description: '', upc_ean: '',
                        categoryId: categories.length > 0 ? categories[0].id : '',
                        brandId: brands.length > 0 ? brands[0].id : '',
                        unitId: units.length > 0 ? units[0].id : '',
                        cost: 0, price: 0, minStockAlert: 0,
                        taxRate: settings?.defaultTaxRate || 0,
                        taxInclusive: false,
                        stockLevels: initialStockLevels,
                    });
                    setLoading(false);
                }
            } catch (err) {
                setError("Erreur de chargement du produit.");
                console.error(err);
                setLoading(false);
            }
        };

        initForm();
    }, [id, isEditing, location.state, dataLoading, categories, brands, units, warehouses, settings]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const isNumber = ['price', 'cost', 'minStockAlert', 'wholesalePrice', 'taxRate'].includes(name);
        setFormState(prev => ({ ...prev, [name]: isNumber ? parseFloat(value) || 0 : value }));
    };
    
    const generateSKU = () => {
        const namePart = formState.name?.substring(0, 3).toUpperCase() || 'PROD';
        const brandPart = brands.find(b => b.id === formState.brandId)?.name.substring(0, 3).toUpperCase() || 'BRA';
        const randomPart = Math.floor(1000 + Math.random() * 9000);
        const newSku = `${namePart}-${brandPart}-${randomPart}`;
        setFormState(prev => ({ ...prev, sku: newSku }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setFormState(prev => ({...prev, imageUrl: base64String}));
                setImagePreview(base64String);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleFormSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);

        if (!formState.categoryId) {
            setError("Veuillez sélectionner une catégorie.");
            setIsSaving(false);
            return;
        }
        if (formState.type === 'product' && (!formState.brandId || !formState.unitId)) {
            setError("Veuillez sélectionner une marque et une unité pour un produit physique.");
            setIsSaving(false);
            return;
        }

        try {
            const { id: formId, ...rawProductData } = formState;

            // Clean data to avoid undefined/null issues
            const productData: any = {
                type: rawProductData.type || 'product',
                name: rawProductData.name?.trim(),
                sku: rawProductData.sku?.trim(),
                categoryId: rawProductData.categoryId,
                brandId: rawProductData.brandId || null,
                unitId: rawProductData.unitId || null,
                supplierId: rawProductData.supplierId || null,
                imageUrl: rawProductData.imageUrl || null,
                description: rawProductData.description || null,
                upc_ean: rawProductData.upc_ean || null,
                cost: rawProductData.cost || 0,
                price: rawProductData.price || 0,
                wholesalePrice: rawProductData.wholesalePrice || 0,
                taxRate: rawProductData.taxRate || 0,
                taxInclusive: rawProductData.taxInclusive || false,
                minStockAlert: rawProductData.minStockAlert || 0,
                stockLevels: rawProductData.stockLevels || []
            };

            if (productData.type === 'service') {
                productData.cost = 0;
                productData.price = 0;
                productData.brandId = null;
                productData.unitId = null;
                productData.minStockAlert = 0;
                productData.stockLevels = [];
            }

            if (isEditing && id) {
                const { error } = await supabase.from('products').update(productData).eq('id', id);
                if (error) throw error;
            } else {
                const newId = crypto.randomUUID();
                const { error } = await supabase.from('products').insert({ ...productData, id: newId });
                if (error) throw error;
            }
            await refreshData(['products']);
            
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                navigate('/products');
            }, 2000);
        } catch (err: any) {
            console.error("Error saving product: ", err);
            setError(`Erreur: ${err.message || "Impossible de sauvegarder le produit."}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    if (loading) return <div className="text-center p-8">Chargement du formulaire...</div>;

    return (
        <div className="relative">
            {/* Notification de succès */}
            {showSuccess && (
                <div className="fixed top-4 right-4 z-50 animate-bounce">
                    <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-bold">
                            {isEditing ? "Produit modifié avec succès !" : "Produit créé avec succès !"}
                        </span>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
                <h1 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
                    {isEditing ? "Modifier l'Article" : "Ajouter un Article"}
                </h1>

                {error && (
                    <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
                        {error}
                    </div>
                )}

                <form onSubmit={handleFormSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nom de l'article</label><input type="text" name="name" value={formState.name || ''} onChange={handleFormChange} required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" /></div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type d'article</label>
                            <select name="type" value={formState.type} onChange={handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                <option value="product">Produit physique</option>
                                <option value="service">Service</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Code (SKU)</label>
                            <div className="flex items-center space-x-2 mt-1">
                                <input type="text" name="sku" value={formState.sku || ''} onChange={handleFormChange} required className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                <button type="button" onClick={generateSKU} className="flex-shrink-0 px-3 py-2 text-sm font-medium text-white bg-gray-600 border border-transparent rounded-md shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">Générer</button>
                            </div>
                        </div>
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Catégorie</label><select name="categoryId" value={formState.categoryId || ''} onChange={handleFormChange} required className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                        
                        {formState.type === 'product' && (
                            <>
                                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Marque</label><select name="brandId" value={formState.brandId || ''} onChange={handleFormChange} required={formState.type === 'product'} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                                <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Unité</label><select name="unitId" value={formState.unitId || ''} onChange={handleFormChange} required={formState.type === 'product'} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                            </>
                        )}

                         <div className="md:col-span-2 lg:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Image de l'article</label>
                            <div className="mt-1 flex items-center space-x-4">
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Aperçu" className="h-16 w-16 rounded-md object-cover" />
                                ) : (
                                    <div className="h-16 w-16 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                                        <ImageIcon className="h-8 w-8" />
                                    </div>
                                )}
                                <label htmlFor="image-upload" className="cursor-pointer bg-white dark:bg-gray-700 py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <span>Choisir un fichier</span>
                                    <input id="image-upload" name="image-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                                </label>
                            </div>
                        </div>
                        {formState.type === 'product' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Coût d'achat</label>
                                <input type="number" step="any" name="cost" value={formState.cost || ''} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                        )}
                        {formState.type === 'product' && (
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prix de vente</label>
                                <input type="number" step="any" name="price" value={formState.price || ''} onChange={handleFormChange} required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                        )}
                        {formState.type === 'product' && (
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prix de gros</label>
                                <input type="number" step="any" name="wholesalePrice" value={formState.wholesalePrice || ''} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fournisseur</label>
                            <select name="supplierId" value={formState.supplierId || ''} onChange={handleFormChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                <option value="">Aucun</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Taux de TVA (%)</label>
                             <input type="number" step="any" name="taxRate" value={formState.taxRate === undefined ? '' : formState.taxRate} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div className="flex items-end">
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center">
                                    <input id="tax-inclusive" name="tax-type" type="radio" checked={formState.taxInclusive === true} onChange={() => setFormState(prev => ({ ...prev, taxInclusive: true }))} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300" />
                                    <label htmlFor="tax-inclusive" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">TVA Inclus</label>
                                </div>
                                <div className="flex items-center">
                                    <input id="tax-exclusive" name="tax-type" type="radio" checked={formState.taxInclusive === false || formState.taxInclusive === undefined} onChange={() => setFormState(prev => ({ ...prev, taxInclusive: false }))} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300" />
                                    <label htmlFor="tax-exclusive" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">TVA Exclus</label>
                                </div>
                            </div>
                        </div>
                        {formState.type === 'product' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Alerte Stock (Qté min.)</label>
                                <input type="number" name="minStockAlert" value={formState.minStockAlert || ''} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                        )}
                    </div>
                {formState.type === 'product' && (
                    <div className="pt-4 border-t dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-800 dark:text-white">Niveaux de stock par entrepôt</h3>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Les niveaux de stock initiaux sont gérés via les pages Inventaire et Transferts, et non directement ici.</p>
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {warehouses.map(wh => (<div key={wh.id}><label htmlFor={`stock-${wh.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{wh.name}</label><input id={`stock-${wh.id}`} type="number" value={formState.stockLevels?.find(sl => sl.warehouseId === wh.id)?.quantity || 0} disabled className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm dark:bg-gray-600 dark:border-gray-500 dark:text-gray-300 cursor-not-allowed"/></div>))}
                        </div>
                    </div>
                )}
                <div className="mt-6 flex justify-end space-x-3">
                    <button type="button" onClick={() => navigate('/products')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Annuler</button>
                    <button type="submit" disabled={isSaving || showSuccess} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
                        {isSaving ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Enregistrement...
                            </>
                        ) : (
                            isEditing ? 'Sauvegarder' : 'Créer le produit'
                        )}
                    </button>
                </div>
            </form>
        </div>
    </div>
    );
};

export default ProductFormPage;