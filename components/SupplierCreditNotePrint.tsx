
import React from 'react';
import { SupplierCreditNote, Supplier, AppSettings } from '../types';
import { formatCurrency } from '../utils/formatters';

interface SupplierCreditNotePrintProps {
    note: SupplierCreditNote;
    supplier: Supplier;
    settings: AppSettings | null;
}

export const SupplierCreditNotePrint = React.forwardRef<HTMLDivElement, SupplierCreditNotePrintProps>((props, ref) => {
    const { note, supplier, settings } = props;
    
    const formatDate = (date: string) => new Date(date).toLocaleDateString('fr-FR');

    return (
        <div ref={ref} className="bg-white p-8 max-w-[210mm] mx-auto text-black font-sans" style={{ minHeight: '297mm' }}>
            {/* Header */}
            <div className="flex justify-between items-start mb-12">
                <div>
                    <img src={settings?.companyLogoUrl || '/logo.svg'} alt="Logo" className="h-24 w-auto mb-4 object-contain"/>
                    <h1 className="text-2xl font-black uppercase tracking-tight">{settings?.companyName || 'ETS COUL & FRERES'}</h1>
                    <p className="text-sm text-gray-600">{settings?.companyAddress}</p>
                    <p className="text-sm text-gray-600">{settings?.companyPhone}</p>
                    {settings?.companyEmail && <p className="text-sm text-gray-600">{settings.companyEmail}</p>}
                </div>
                <div className="text-right">
                    <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tighter mb-2">Avoir Fournisseur</h2>
                    <p className="text-lg font-bold text-gray-500">#{note.referenceNumber}</p>
                    <p className="text-sm font-medium text-gray-400 mt-1">Date: {formatDate(note.date)}</p>
                </div>
            </div>

            {/* Supplier Info */}
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 mb-12">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Fournisseur</p>
                <h3 className="text-xl font-bold text-gray-900">{supplier.name}</h3>
                {supplier.businessName && <p className="text-sm text-gray-600">{supplier.businessName}</p>}
                {supplier.phone && <p className="text-sm text-gray-600">Tel: {supplier.phone}</p>}
                {supplier.address && <p className="text-sm text-gray-600">{supplier.address}</p>}
            </div>

            {/* Items Table (if any) */}
            {note.items && note.items.length > 0 && (
                <div className="mb-12">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b-2 border-gray-900">
                                <th className="py-3 text-left text-xs font-black uppercase tracking-widest">Désignation</th>
                                <th className="py-3 text-center text-xs font-black uppercase tracking-widest">Qté</th>
                                <th className="py-3 text-right text-xs font-black uppercase tracking-widest">Prix U.</th>
                                <th className="py-3 text-right text-xs font-black uppercase tracking-widest">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {note.items.map((item, index) => (
                                <tr key={index}>
                                    <td className="py-3 text-sm font-medium">{item.productName}</td>
                                    <td className="py-3 text-center text-sm">{item.quantity}</td>
                                    <td className="py-3 text-right text-sm">{formatCurrency(item.price)}</td>
                                    <td className="py-3 text-right text-sm font-bold">{formatCurrency(item.subtotal)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Totals */}
            <div className="flex justify-end mb-12">
                <div className="w-64">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-sm font-medium text-gray-500">Total</span>
                        <span className="text-xl font-black text-gray-900">{formatCurrency(note.amount)}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-auto pt-12 border-t border-gray-100">
                <p className="text-xs text-gray-400 font-medium">{settings?.footerText || 'Merci de votre confiance.'}</p>
            </div>
        </div>
    );
});
