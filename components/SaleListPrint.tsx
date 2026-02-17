
import React from 'react';
import { Sale, AppSettings, Customer, Warehouse } from '../types';
import { formatCurrency } from '../utils/formatters';

interface SaleListPrintProps {
    sales: Sale[];
    settings: AppSettings | null;
    customers: Customer[];
    warehouses: Warehouse[];
    period: { start: string; end: string } | null;
}

export const SaleListPrint = React.forwardRef<HTMLDivElement, SaleListPrintProps>((props, ref) => {
    const { sales, settings, customers, warehouses, period } = props;

    const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || 'client de passage';
    const getWarehouseName = (id: string) => warehouses.find(w => w.id === id)?.name || 'N/A';

    const totalAmount = sales.reduce((sum, s) => sum + s.grandTotal, 0);
    const totalPaid = sales.reduce((sum, s) => sum + s.paidAmount, 0);
    const totalBalance = sales.reduce((sum, s) => sum + (s.grandTotal - s.paidAmount), 0);

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
                    <img src={settings?.companyLogoUrl || '/logo.png'} alt="Logo" className="h-16 w-auto object-contain"/>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight">{settings?.companyName || 'Mon Entreprise'}</h1>
                        <p className="text-xs text-gray-600">{settings?.companyAddress}</p>
                        <p className="text-xs text-gray-600">{settings?.companyPhone}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-black uppercase tracking-tighter">Journal des Ventes</h2>
                    <p className="text-xs font-medium text-gray-500 mt-1">Date d'édition: {new Date().toLocaleDateString('fr-FR')}</p>
                    {period && (
                         <p className="text-xs font-medium text-gray-500">Période: {period.start || 'Début'} au {period.end || 'Ce jour'}</p>
                    )}
                    <p className="text-xs font-medium text-gray-500">Nombre de ventes: {sales.length}</p>
                </div>
            </div>

            {/* Table */}
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-100 border-y border-gray-300">
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider w-10">#</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Date</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Référence</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Client</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Entrepôt</th>
                        <th className="py-2 px-2 text-center font-black uppercase tracking-wider">Statut</th>
                        <th className="py-2 px-2 text-right font-black uppercase tracking-wider">Montant Total</th>
                        <th className="py-2 px-2 text-right font-black uppercase tracking-wider">Payé</th>
                        <th className="py-2 px-2 text-right font-black uppercase tracking-wider">Reste</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {sales.map((sale, index) => {
                        const balance = sale.grandTotal - sale.paidAmount;
                        
                        return (
                            <tr key={sale.id} className="break-inside-avoid print:break-inside-avoid">
                                <td className="py-2 px-2 text-gray-500">{index + 1}</td>
                                <td className="py-2 px-2">{new Date(sale.date).toLocaleDateString('fr-FR')} {new Date(sale.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</td>
                                <td className="py-2 px-2 font-mono font-bold">{sale.referenceNumber}</td>
                                <td className="py-2 px-2">{getCustomerName(sale.customerId)}</td>
                                <td className="py-2 px-2 text-[10px] uppercase">{getWarehouseName(sale.warehouseId)}</td>
                                <td className="py-2 px-2 text-center text-[10px] uppercase">
                                    <span className={`px-2 py-1 rounded-full ${
                                        sale.paymentStatus === 'Payé' ? 'bg-green-100 text-green-800' :
                                        sale.paymentStatus === 'Partiel' ? 'bg-orange-100 text-orange-800' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                        {sale.paymentStatus}
                                    </span>
                                </td>
                                <td className="py-2 px-2 text-right font-mono font-bold">
                                    {formatCurrency(sale.grandTotal)}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-green-600">
                                    {formatCurrency(sale.paidAmount)}
                                </td>
                                <td className={`py-2 px-2 text-right font-mono font-bold ${balance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                    {formatCurrency(balance)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-gray-800 bg-gray-50">
                        <td colSpan={6} className="py-3 px-2 text-right font-black uppercase tracking-widest">Totaux</td>
                        <td className="py-3 px-2 text-right font-black text-sm">{formatCurrency(totalAmount)}</td>
                        <td className="py-3 px-2 text-right font-black text-sm text-green-700">{formatCurrency(totalPaid)}</td>
                        <td className="py-3 px-2 text-right font-black text-sm text-red-700">{formatCurrency(totalBalance)}</td>
                    </tr>
                </tfoot>
            </table>

            {/* Footer */}
            <div className="print-footer mt-8 pt-4 border-t border-gray-200">
                <p className="text-center text-[10px] text-gray-500">Document généré le {new Date().toLocaleString('fr-FR')} par le système.</p>
            </div>
        </div>
    );
});
