import React from 'react';
import { SalePayment, Customer, AppSettings } from '../types';
import { formatCurrency } from '../utils/formatters';

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
    
    // Obtenir la date et l'heure actuelles
    // Si l'utilisateur est au Bénin (GMT+1)
    const now = new Date();
    
    // Formatage manuel pour être sûr de l'heure locale
    const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // Formatage de la date du paiement (qui peut être différente de l'édition)
    const paymentDateStr = new Date(payment.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const paymentTimeStr = new Date(payment.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const amountWords = numberToWords(Math.floor(payment.amount)).toUpperCase() + " FRANCS CFA";

    return (
        <div 
            id="payment-receipt-capture"
            ref={ref} 
            className="bg-white p-4 mx-auto text-black font-sans text-sm payment-receipt-container" 
            style={{ width: '80mm', minHeight: 'auto', paddingBottom: '20px' }}
        >
            {/* Header */}
            <div className="text-center mb-2">
                <img 
                    src={settings?.companyLogoUrl || '/logo.png'} 
                    alt="Logo" 
                    className="mx-auto h-12 w-auto mb-1 object-contain"
                    crossOrigin="anonymous"
                />
                <h1 className="font-bold text-sm uppercase leading-tight">{settings?.companyName || 'GROUP SYBA DISTRIBUTION & SERVICES'}</h1>
                <p className="text-[10px] leading-tight">{settings?.companyAddress || 'Cotonou, Bénin'}</p>
                <p className="text-[10px] leading-tight">{settings?.companyPhone || '+229 00 00 00 00'}</p>
            </div>

            {/* Title */}
            <div className="bg-gray-100 text-center py-1 mb-2 border-y border-gray-300">
                <h2 className="font-bold text-sm uppercase tracking-wide">Reçu de versement</h2>
            </div>

            {/* Receipt Info */}
            <div className="flex justify-between items-center mb-2 text-xs px-2">
                <p><span className="font-bold">N°:</span> {payment.id === 'TEMP_RECEIPT' ? Math.floor(Date.now() / 1000).toString().slice(-4) : payment.id.slice(-4).toUpperCase()}</p>
                <p><span className="font-bold">Date:</span> {paymentDateStr} à {paymentTimeStr}</p>
            </div>

            {/* Customer */}
            <div className="mb-2 px-2 border-b border-dashed border-gray-300 pb-2">
                <p className="text-[10px] text-gray-500 uppercase">Reçu de:</p>
                <p className="font-bold text-sm uppercase truncate">{customer.name}</p>
            </div>

            {/* Amount */}
            <div className="mb-2 px-2 bg-gray-50 py-2 rounded border border-gray-200">
                <div className="flex justify-between items-baseline">
                    <span className="font-bold text-xs text-gray-600">Montant:</span>
                    <span className="font-black text-lg">{formatCurrency(payment.amount)}</span>
                </div>
                <p className="text-[10px] italic uppercase text-gray-500 mt-1 leading-tight border-t border-gray-200 pt-1">
                    {amountWords}
                </p>
            </div>

            {/* Details */}
            <div className="mb-2 px-2 space-y-1 text-xs">
                <div className="flex justify-between">
                    <span className="text-gray-600">Mode:</span>
                    <span className="font-bold uppercase">{payment.method}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Motif:</span>
                    <span className="font-bold uppercase italic text-right truncate ml-2">{payment.notes || reference || 'REGLEMENT'}</span>
                </div>
            </div>

            {/* Balance */}
            <div className="border border-gray-800 rounded p-2 mb-2 flex justify-between items-center mx-2 bg-white">
                <span className="text-[10px] font-bold uppercase">Solde après:</span>
                <span className="font-black text-sm">{formatCurrency(balanceAfter)}</span>
            </div>

            {/* Footer */}
            <div className="text-[9px] text-gray-400 text-center italic mt-2">
                <p>Édité le {dateStr} à {timeStr}</p>
                <p>MERCI DE VOTRE CONFIANCE !</p>
            </div>
        </div>
    );
});

PaymentReceipt.displayName = "PaymentReceipt";

export default PaymentReceipt;
