import React from 'react';
import { SalePayment, Customer, AppSettings } from '../types';

interface PaymentReceiptProps {
    payment: SalePayment;
    customer: Customer;
    settings: AppSettings | null;
    balanceAfter: number;
    reference: string; // Sale reference or "Solde d'ouverture"
}

// Simple French number to words converter (simplified for common range)
const numberToWords = (num: number): string => {
    const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

    if (num === 0) return 'zéro';

    const convertChunk = (n: number): string => {
        if (n < 10) return units[n];
        if (n < 20) return teens[n - 10];
        if (n < 100) {
            const ten = Math.floor(n / 10);
            const unit = n % 10;
            if (ten === 7 || ten === 9) {
                return `${tens[ten - 1]}-${teens[unit] || 'dix'}`; // 70-79, 90-99 logic simplified
            }
            // Fix for 71, 91, etc (soixante-et-onze) - Simplified for now
            return `${tens[ten]}${unit ? (unit === 1 && ten !== 8 ? '-et-un' : '-' + units[unit]) : ''}`;
        }
        if (n < 1000) {
            const hundred = Math.floor(n / 100);
            const rest = n % 100;
            if (hundred === 1) return `cent${rest ? ' ' + convertChunk(rest) : ''}`;
            return `${units[hundred]} cent${rest ? ' ' + convertChunk(rest) : ''}`;
        }
        return n.toString(); // Fallback for larger numbers if not fully implemented
    };

    // Very basic implementation for the receipt. 
    // For production, a robust library like 'number-to-words-fr' is recommended.
    // This handles up to 999 999 reasonably well.
    
    if (num >= 1000000) return num.toString() + " (Conversion limitée)";
    
    if (num >= 1000) {
        const thousands = Math.floor(num / 1000);
        const rest = num % 1000;
        const thousandsText = thousands === 1 ? 'mille' : `${convertChunk(thousands)} mille`;
        return `${thousandsText}${rest ? ' ' + convertChunk(rest) : ''}`;
    }

    return convertChunk(num);
};

export const PaymentReceipt = React.forwardRef<HTMLDivElement, PaymentReceiptProps>((props, ref) => {
    const { payment, customer, settings, balanceAfter, reference } = props;
    
    // Format date
    const dateObj = new Date(payment.date);
    const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }); // dd/mm/yy
    const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const amountWords = numberToWords(Math.floor(payment.amount)).toUpperCase() + " FRANCS CFA";

    return (
        <div ref={ref} className="bg-white p-8 max-w-[80mm] mx-auto text-black font-sans text-sm" style={{ width: '80mm', minHeight: '100mm' }}>
            {/* Header */}
            <div className="text-center mb-4">
                <img src={settings?.companyLogoUrl || '/logo.png'} alt="Logo" className="mx-auto h-16 w-auto mb-2 object-contain"/>
                <h1 className="font-bold text-lg uppercase">{settings?.companyName || 'ETS COULIBALY & FRERES'}</h1>
                <p className="text-xs">{settings?.companyAddress || 'Korhogo, Abidjan , lagune, BP 287, Côte d\'ivoire'}</p>
                <p className="text-xs">{settings?.companyPhone || '05 05 18 22 16 / 07 08 34 13 22'}</p>
            </div>

            {/* Title */}
            <div className="bg-indigo-100 text-center py-2 mb-4 border-y-2 border-indigo-200">
                <h2 className="font-black text-xl uppercase text-indigo-900 tracking-wider">Reçu de versement</h2>
            </div>

            {/* Receipt Info */}
            <div className="text-center mb-6">
                <p className="font-bold text-lg">N° {payment.id === 'TEMP_RECEIPT' ? Math.floor(Date.now() / 1000).toString().slice(-4) : payment.id.slice(-4).toUpperCase()}</p>
                <p className="font-bold text-gray-600">Date: {dateStr}</p>
            </div>

            {/* Customer */}
            <div className="mb-6 px-4">
                <p className="uppercase text-gray-600 text-xs font-bold mb-1">Reçu de</p>
                <p className="font-black text-lg uppercase">M. {customer.name}</p>
            </div>

            {/* Amount */}
            <div className="mb-6 px-4 bg-gray-50 py-4 rounded-xl border border-gray-100">
                <div className="flex justify-between items-baseline mb-2">
                    <span className="font-bold text-xl text-gray-600">Montant:</span>
                    <span className="font-black text-2xl">{new Intl.NumberFormat('fr-FR').format(payment.amount)}</span>
                </div>
                <p className="text-xs font-bold italic uppercase text-gray-500 tracking-wide border-t border-gray-200 pt-2 mt-1">
                    ({amountWords})
                </p>
            </div>

            {/* Details */}
            <div className="mb-8 px-4 space-y-2 text-sm">
                <div className="flex justify-between border-b border-dashed border-gray-200 pb-1">
                    <span className="text-gray-600">Mode:</span>
                    <span className="font-bold uppercase">{payment.method}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-gray-200 pb-1">
                    <span className="text-gray-600">Motif:</span>
                    <span className="font-bold uppercase italic">{payment.notes || reference || 'REGLEMENT'}</span>
                </div>
            </div>

            {/* Timestamps */}
            <div className="mb-6 text-[10px] text-gray-400 italic space-y-1 text-center">
                <p>Date de paiement: {dateStr}</p>
                <p>Date d'édition: {dateStr}</p>
                <p>Heure d'édition: {timeStr}</p>
            </div>

            {/* Balance */}
            <div className="border-2 border-gray-800 rounded-xl p-3 bg-white flex justify-between items-center shadow-sm mx-4">
                <span className="text-xs font-bold uppercase">Solde après édition:</span>
                <span className="font-black text-xl">{new Intl.NumberFormat('fr-FR').format(balanceAfter)}</span>
            </div>
        </div>
    );
});

PaymentReceipt.displayName = "PaymentReceipt";

export default PaymentReceipt;
