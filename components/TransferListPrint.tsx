
import React from 'react';
import { WarehouseTransfer, Warehouse, AppSettings } from '../types';

interface TransferListPrintProps {
    transfers: WarehouseTransfer[];
    warehouses: Warehouse[];
    settings: AppSettings | null;
    title?: string;
    period?: string;
}

export const TransferListPrint = React.forwardRef<HTMLDivElement, TransferListPrintProps>((props, ref) => {
    const { transfers, warehouses, settings, title = 'Liste des Transferts', period } = props;

    const getWarehouseName = (id: string) => warehouses.find(w => w.id === id)?.name || 'Inconnu';

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
                    {period && <p className="text-xs font-medium text-gray-500">Période: {period}</p>}
                    <p className="text-xs font-medium text-gray-500">Nombre de transferts: {transfers.length}</p>
                </div>
            </div>

            {/* Table */}
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-100 border-y border-gray-300">
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider w-10">#</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Date</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Source</th>
                        <th className="py-2 px-2 text-center font-black uppercase tracking-wider">→</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Destination</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Chauffeur</th>
                        <th className="py-2 px-2 text-center font-black uppercase tracking-wider">Articles</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {transfers.map((t, index) => (
                        <tr key={t.id || index} className="break-inside-avoid print:break-inside-avoid">
                            <td className="py-2 px-2 text-gray-500">{index + 1}</td>
                            <td className="py-2 px-2">{new Date(t.date).toLocaleDateString('fr-FR')} {new Date(t.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</td>
                            <td className="py-2 px-2 font-bold uppercase text-[10px]">
                                {getWarehouseName(t.fromWarehouseId)}
                            </td>
                            <td className="py-2 px-2 text-center text-gray-400">→</td>
                            <td className="py-2 px-2 font-bold uppercase text-[10px]">
                                {getWarehouseName(t.toWarehouseId)}
                            </td>
                            <td className="py-2 px-2 text-[10px]">
                                {t.driverName || '-'}
                            </td>
                            <td className="py-2 px-2 text-center font-mono font-bold">
                                {t.items?.length || 0}
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
