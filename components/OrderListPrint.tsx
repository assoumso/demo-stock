
import React from 'react';
import { Order, AppSettings } from '../types';
import { formatCurrency } from '../utils/formatters';

interface OrderListPrintProps {
    orders: Order[];
    settings: AppSettings | null;
    title?: string;
}

export const OrderListPrint = React.forwardRef<HTMLDivElement, OrderListPrintProps>((props, ref) => {
    const { orders, settings, title = 'Liste des Commandes' } = props;

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
                    <h2 className="text-2xl font-black uppercase tracking-tighter">{title}</h2>
                    <p className="text-xs font-medium text-gray-500 mt-1">Date d'édition: {new Date().toLocaleDateString('fr-FR')}</p>
                    <p className="text-xs font-medium text-gray-500">Nombre de commandes: {orders.length}</p>
                </div>
            </div>

            {/* Table */}
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-100 border-y border-gray-300">
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider w-10">#</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">N° Commande</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Client</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Date</th>
                        <th className="py-2 px-2 text-center font-black uppercase tracking-wider">Statut</th>
                        <th className="py-2 px-2 text-right font-black uppercase tracking-wider">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {orders.map((order, index) => (
                        <tr key={order.id || index} className="break-inside-avoid print:break-inside-avoid">
                            <td className="py-2 px-2 text-gray-500">{index + 1}</td>
                            <td className="py-2 px-2 font-mono font-bold">{order.orderNumber}</td>
                            <td className="py-2 px-2">{order.customerName}</td>
                            <td className="py-2 px-2">{new Date(order.createdAt).toLocaleDateString('fr-FR')}</td>
                            <td className="py-2 px-2 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                    order.status === 'Payée' ? 'bg-green-100 text-green-800 border-green-200' :
                                    order.status === 'En attente' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                    'bg-red-100 text-red-800 border-red-200'
                                }`}>
                                    {order.status}
                                </span>
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold">
                                {formatCurrency(order.total)}
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
