import React from 'react';
import { AppSettings } from '../types';
import { formatCurrency } from '../utils/formatters';

interface PaymentListPrintProps {
    payments: any[];
    settings: AppSettings | null;
    title: string;
    period?: string;
}

export const PaymentListPrint = React.forwardRef<HTMLDivElement, PaymentListPrintProps>((props, ref) => {
    const { payments, settings, title, period } = props;

    const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

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
                    <h2 className="text-2xl font-black uppercase tracking-tighter">{title}</h2>
                    <p className="text-xs font-medium text-gray-500 mt-1">Date d'édition: {new Date().toLocaleDateString('fr-FR')}</p>
                    {period && <p className="text-xs font-medium text-gray-500">Période: {period}</p>}
                    <p className="text-xs font-medium text-gray-500">Nombre d'opérations: {payments.length}</p>
                </div>
            </div>

            {/* Table */}
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-100 border-y border-gray-300">
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider w-10">#</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Date</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Référence</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Tiers (Client/Fournisseur)</th>
                        <th className="py-2 px-2 text-center font-black uppercase tracking-wider">Méthode</th>
                        <th className="py-2 px-2 text-right font-black uppercase tracking-wider">Montant</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {payments.map((p, index) => (
                        <tr key={p.id || index} className="break-inside-avoid print:break-inside-avoid">
                            <td className="py-2 px-2 text-gray-500">{index + 1}</td>
                            <td className="py-2 px-2">{new Date(p.date).toLocaleDateString('fr-FR')} {new Date(p.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</td>
                            <td className="py-2 px-2">
                                <span className="font-mono font-bold text-[10px]">{p.invoiceRef || '-'}</span>
                            </td>
                            <td className="py-2 px-2 font-bold uppercase text-[10px]">
                                {p.partnerName || 'Inconnu'}
                            </td>
                            <td className="py-2 px-2 text-center text-[10px] uppercase">
                                {p.method}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold">
                                {formatCurrency(p.amount)}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-gray-800 bg-gray-50">
                        <td colSpan={5} className="py-3 px-2 text-right font-black uppercase tracking-widest">Total Période</td>
                        <td className="py-3 px-2 text-right font-black text-sm">{formatCurrency(totalAmount)}</td>
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
