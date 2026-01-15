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
            <div className="bg-blue-100 text-center py-1 mb-4 border-y border-blue-200">
                <h2 className="font-bold text-xl uppercase">Reçu de versement</h2>
            </div>

            {/* Receipt Info */}
            <div className="text-center mb-4">
                <p className="font-bold text-lg">N° {payment.id.slice(-4).toUpperCase()}</p>
                <p className="font-bold">Date: {dateStr}</p>
            </div>

            {/* Customer */}
            <div className="mb-4">
                <p className="uppercase">Reçu de <span className="font-bold">M. {customer.name}</span></p>
            </div>

            {/* Amount */}
            <div className="mb-4">
                <div className="flex justify-between items-baseline mb-1">
                    <span className="font-bold text-xl">Montant:</span>
                    <span className="font-bold text-xl">{new Intl.NumberFormat('fr-FR').format(payment.amount)}</span>
                </div>
                <p className="text-xs italic uppercase">({amountWords})</p>
            </div>

            {/* Details */}
            <div className="mb-6 space-y-1">
                <p>Mode: <span className="uppercase">{payment.method}</span></p>
                <p>Motif: <span className="uppercase italic">{payment.notes || reference || 'REGLEMENT'}</span></p>
            </div>

            {/* Timestamps */}
            <div className="mb-6 text-xs text-gray-600 italic space-y-1">
                <p className="underline">Date de paiement: {dateStr}</p>
                <p className="underline">Date d'édition: {dateStr}</p>
                <p className="underline">Heure d'édition: {timeStr}</p>
            </div>

            {/* Balance */}
            <div className="border rounded-xl p-2 bg-gray-50 flex justify-between items-center">
                <span className="text-xs">Solde après édition:</span>
                <span className="font-bold text-lg">{new Intl.NumberFormat('fr-FR').format(balanceAfter)}</span>
            </div>
        </div>
    );
});

PaymentReceipt.displayName = "PaymentReceipt";

export default PaymentReceipt;
