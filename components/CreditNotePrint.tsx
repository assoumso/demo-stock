
import React from 'react';
import { CreditNote, Customer, AppSettings } from '../types';

interface CreditNotePrintProps {
    note: CreditNote;
    customer: Customer;
    settings: AppSettings | null;
}

export const CreditNotePrint = React.forwardRef<HTMLDivElement, CreditNotePrintProps>((props, ref) => {
    const { note, customer, settings } = props;
    
    const formatCurrency = (val: number) => new Intl.NumberFormat('fr-FR').format(val).replace(/\u202f/g, ' ') + ' FCFA';
    const formatDate = (date: string) => new Date(date).toLocaleDateString('fr-FR');

    return (
        <div ref={ref} className="bg-white p-8 max-w-[210mm] mx-auto text-black font-sans" style={{ minHeight: '297mm' }}>
            {/* Header */}
            <div className="flex justify-between items-start mb-12">
                <div>
                    <img src={settings?.companyLogoUrl || '/logo.png'} alt="Logo" className="h-24 w-auto mb-4 object-contain"/>
                    <h1 className="text-2xl font-black uppercase tracking-tight">{settings?.companyName || 'ETS COULIBALY & FRERES'}</h1>
                    <p className="text-sm text-gray-600">{settings?.companyAddress}</p>
                    <p className="text-sm text-gray-600">{settings?.companyPhone}</p>
                    {settings?.companyEmail && <p className="text-sm text-gray-600">{settings.companyEmail}</p>}
                </div>
                <div className="text-right">
                    <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tighter mb-2">Note de Crédit</h2>
                    <p className="text-lg font-bold text-gray-500">#{note.referenceNumber}</p>
                    <p className="text-sm font-medium text-gray-400 mt-1">Date: {formatDate(note.date)}</p>
                </div>
            </div>

            {/* Customer Info */}
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 mb-12">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Client</p>
                <h3 className="text-xl font-bold text-gray-900">{customer.name}</h3>
                {customer.businessName && <p className="text-sm text-gray-600">{customer.businessName}</p>}
                {customer.phone && <p className="text-sm text-gray-600">Tel: {customer.phone}</p>}
                {customer.address && <p className="text-sm text-gray-600">{customer.address}</p>}
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
                        <tbody className="divide-y divide-gray-200">
                            {note.items.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="py-4 text-sm font-bold">{item.productName || item.productId}</td>
                                    <td className="py-4 text-center text-sm">{item.quantity}</td>
                                    <td className="py-4 text-right text-sm">{formatCurrency(item.price)}</td>
                                    <td className="py-4 text-right text-sm font-bold">{formatCurrency(item.subtotal)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Totals */}
            <div className="flex justify-end mb-12">
                <div className="w-64">
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-bold text-gray-600">Sous-total</span>
                        <span className="text-sm font-bold">{formatCurrency(note.amount)}</span>
                    </div>
                    <div className="flex justify-between items-center py-4 border-b-2 border-gray-900">
                        <span className="text-lg font-black uppercase">Total Crédit</span>
                        <span className="text-xl font-black text-primary-600">{formatCurrency(note.amount)}</span>
                    </div>
                </div>
            </div>

            {/* Reason */}
            <div className="mb-12">
                <h4 className="text-sm font-black uppercase tracking-widest mb-2 border-b border-gray-200 pb-2">Motif / Notes</h4>
                <p className="text-sm text-gray-700 italic">{note.reason}</p>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-400 mt-auto pt-12 border-t border-gray-100">
                <p>Ce document est une preuve d'avoir. Le montant a été crédité sur votre compte client.</p>
                <p className="mt-2">{settings?.companyName} - {settings?.companyAddress}</p>
            </div>
        </div>
    );
});
