
import React from 'react';
import { Product, Category, Brand, Supplier, AppSettings } from '../types';
import { formatCurrency } from '../utils/formatters';

interface ProductListPrintProps {
    products: Product[];
    categories: Category[];
    brands: Brand[];
    suppliers: Supplier[];
    settings: AppSettings | null;
    title?: string;
    filters?: {
        category?: string;
        brand?: string;
        supplier?: string;
        warehouse?: string;
    };
}

export const ProductListPrint = React.forwardRef<HTMLDivElement, ProductListPrintProps>((props, ref) => {
    const { products, categories, brands, suppliers, settings, title = 'Liste des Produits', filters } = props;

    React.useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            @media print {
                @page {
                    size: A4;
                    margin: 10mm;
                }
                body {
                    print-color-adjust: exact;
                    -webkit-print-color-adjust: exact;
                }
                .print-footer {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    text-align: center;
                    font-size: 10px;
                    color: #9ca3af;
                    padding: 16px;
                    background: white;
                }
            }
        `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    const getCategoryName = (id?: string) => categories.find(c => c.id === id)?.name || '-';
    const getBrandName = (id?: string) => brands.find(b => b.id === id)?.name || '-';
    const getSupplierName = (id?: string) => suppliers.find(s => s.id === id)?.name || '-';

    const getTotalStock = (product: Product) => {
        if (!filters?.warehouse || filters.warehouse === 'all') {
            return (product.stockLevels || []).reduce((sum, sl) => sum + sl.quantity, 0);
        }
        return (product.stockLevels || []).find(sl => sl.warehouseId === filters.warehouse)?.quantity || 0;
    };

    return (
        <div ref={ref} className="bg-white p-8 mx-auto text-black font-sans text-xs print:max-w-none print:w-[210mm] print:min-h-[297mm] print:shadow-none" style={{ minHeight: '210mm', width: '210mm' }}>
             {/* Header */}
             <div className="flex justify-between items-start mb-8 border-b-2 border-gray-800 pb-4">
                <div className="flex items-center gap-4">
                    <img src={settings?.companyLogoUrl || '/logo.png'} alt="Logo" className="h-16 w-auto object-contain"/>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight">{settings?.companyName || 'Mon Entreprise'}</h1>
                        <p className="text-xs text-gray-600">{settings?.companyAddress}</p>
                        <p className="text-xs text-gray-600">{settings?.companyPhone}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-black uppercase tracking-tighter">{title}</h2>
                    <p className="text-xs font-medium text-gray-500 mt-1">Date d'édition: {new Date().toLocaleDateString('fr-FR')}</p>
                    <p className="text-xs font-medium text-gray-500">Nombre de produits: {products.length}</p>
                </div>
            </div>

            {/* Table */}
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-100 border-y border-gray-300">
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider w-10">#</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">SKU</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Désignation</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Catégorie</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Marque</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Fournisseur</th>
                        <th className="py-2 px-2 text-right font-black uppercase tracking-wider">Stock</th>
                        <th className="py-2 px-2 text-right font-black uppercase tracking-wider">Coût</th>
                        <th className="py-2 px-2 text-right font-black uppercase tracking-wider">Grossiste</th>
                        <th className="py-2 px-2 text-right font-black uppercase tracking-wider">Revendeur</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {products.map((product, index) => (
                        <tr key={product.id || index} className="break-inside-avoid print:break-inside-avoid">
                            <td className="py-2 px-2 text-gray-500">{index + 1}</td>
                            <td className="py-2 px-2 font-mono text-[10px]">{product.sku}</td>
                            <td className="py-2 px-2 font-bold">{product.name}</td>
                            <td className="py-2 px-2">{getCategoryName(product.categoryId)}</td>
                            <td className="py-2 px-2">{getBrandName(product.brandId)}</td>
                            <td className="py-2 px-2">{getSupplierName(product.supplierId)}</td>
                            <td className={`py-2 px-2 text-right font-mono font-bold ${getTotalStock(product) <= (product.minStockAlert || 0) ? 'text-red-600' : ''}`}>
                                {getTotalStock(product)}
                            </td>
                            <td className="py-2 px-2 text-right font-mono">
                                {formatCurrency(product.cost || 0)}
                            </td>
                            <td className="py-2 px-2 text-right font-mono">
                                {formatCurrency(product.wholesalePrice || 0)}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold">
                                {formatCurrency(product.price)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Footer */}
            <div className="print-footer mt-8 pt-4 border-t border-gray-200">
                <p className="text-center text-[10px] text-gray-500">Document généré le {new Date().toLocaleString('fr-FR')} par le système.</p>
            </div>
        </div>
    );
});
