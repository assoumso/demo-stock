
import React from 'react';
import { StockAdjustment, AppSettings, Product, Warehouse } from '../types';

interface StockAdjustmentListPrintProps {
    adjustments: StockAdjustment[];
    settings: AppSettings | null;
    products: Product[];
    warehouses: Warehouse[];
}

const StockAdjustmentListPrint = React.forwardRef<HTMLDivElement, StockAdjustmentListPrintProps>((props, ref) => {
    const { adjustments, settings, products, warehouses } = props;

    const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'Produit Inconnu';
    const getWarehouseName = (id: string) => warehouses.find(w => w.id === id)?.name || 'N/A';

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

    return (
        <div ref={ref} className="bg-white p-8 mx-auto text-black font-sans text-xs print:max-w-none print:w-[210mm] print:min-h-[297mm] print:shadow-none" style={{ minHeight: '210mm', width: '210mm' }}>
            {/* Header */}
            <div className="flex justify-between items-start mb-8 border-b-2 border-gray-800 pb-4">
                <div className="flex items-center gap-4">
                    {settings?.companyLogoUrl && <img src={settings.companyLogoUrl} alt="Logo" className="h-16 w-auto object-contain"/>}
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight">{settings?.companyName || 'Mon Entreprise'}</h1>
                        <p className="text-xs text-gray-600">{settings?.companyAddress}</p>
                        <p className="text-xs text-gray-600">{settings?.companyPhone}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-black uppercase tracking-tighter">Historique Ajustements Stock</h2>
                    <p className="text-xs font-medium text-gray-500 mt-1">Date d'édition: {new Date().toLocaleDateString('fr-FR')}</p>
                    <p className="text-xs font-medium text-gray-500">Nombre d'opérations: {adjustments.length}</p>
                </div>
            </div>

            {/* Table */}
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-100 border-y border-gray-300">
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider w-10">#</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Date</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Entrepôt</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Produit</th>
                        <th className="py-2 px-2 text-center font-black uppercase tracking-wider">Type</th>
                        <th className="py-2 px-2 text-right font-black uppercase tracking-wider">Quantité</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider w-1/4">Motif</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {adjustments.map((adj, index) => {
                        return (
                            <tr key={adj.id} className="break-inside-avoid print:break-inside-avoid">
                                <td className="py-2 px-2 text-gray-500">{index + 1}</td>
                                <td className="py-2 px-2">{new Date(adj.date).toLocaleDateString('fr-FR')}</td>
                                <td className="py-2 px-2 text-[10px] uppercase">{getWarehouseName(adj.warehouseId)}</td>
                                <td className="py-2 px-2">
                                    <div className="font-bold">{getProductName(adj.productId)}</div>
                                </td>
                                <td className="py-2 px-2 text-center text-[10px] uppercase">
                                    <span className={`px-2 py-1 rounded-full ${
                                        adj.type === 'addition' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                        {adj.type === 'addition' ? 'AJOUT' : 'RETRAIT'}
                                    </span>
                                </td>
                                <td className={`py-2 px-2 text-right font-mono font-bold ${adj.type === 'addition' ? 'text-green-600' : 'text-red-600'}`}>
                                    {adj.type === 'addition' ? '+' : '-'}{adj.quantity}
                                </td>
                                <td className="py-2 px-2 text-[10px] italic text-gray-500">
                                    {adj.reason}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Footer */}
            <div className="print-footer mt-8 pt-4 border-t border-gray-200">
                <p className="text-center text-[10px] text-gray-500">Document généré le {new Date().toLocaleString('fr-FR')} par le système.</p>
            </div>
        </div>
    );
});

export default StockAdjustmentListPrint;
