import React from 'react';
import { BankTransaction, AppSettings } from '../types';

interface BankTransactionNoteProps {
    transaction: BankTransaction;
    settings: AppSettings | null;
}

export const BankTransactionNote = React.forwardRef<HTMLDivElement, BankTransactionNoteProps>(({ transaction, settings }, ref) => {
    
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('fr-FR').format(val) + ' FCFA';

    const logoSource = settings?.companyLogoUrl || '/logo.png';
    const isDeposit = transaction.type === 'deposit';
    const title = isDeposit ? "BORDEREAU DE VERSEMENT" : "BORDEREAU DE RETRAIT";

    return (
        <div ref={ref} className="p-8 max-w-4xl mx-auto bg-white text-gray-900 font-sans" style={{ minHeight: '148mm' }}> {/* A5 landscape or half A4 height approx */}
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
                <div>
                    <img src={logoSource} alt="Logo" className="h-20 w-auto object-contain mb-3" />
                    <h1 className="text-lg font-bold uppercase tracking-tight text-gray-900 mb-1">{settings?.companyName}</h1>
                    <div className="text-xs space-y-1 text-gray-600">
                        <p>{settings?.companyAddress}</p>
                        <p>{settings?.companyPhone} {settings?.companyEmail ? `| ${settings.companyEmail}` : ''}</p>
                        {settings?.companyRCCM && <p>RCCM: {settings.companyRCCM}</p>}
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-3xl font-black uppercase tracking-widest text-gray-900 mb-2">{title}</h2>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Réf: {transaction.reference || transaction.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-sm font-bold text-gray-500 mt-1">{formatDate(transaction.date)}</p>
                </div>
            </div>

            {/* Amount Box */}
            <div className="mb-8 p-6 bg-gray-50 border border-gray-200 rounded-xl text-center">
                <p className="text-sm font-bold uppercase text-gray-500 tracking-widest mb-2">Montant de l'opération</p>
                <p className="text-4xl font-black text-gray-900">{formatCurrency(transaction.amount)}</p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-12">
                <div className="border-b border-gray-200 pb-2">
                    <p className="text-xs font-bold uppercase text-gray-400 mb-1">Type d'opération</p>
                    <p className="font-bold text-lg text-gray-800">
                        {isDeposit ? 'Crédit (+)' : 'Débit (-)'}
                    </p>
                </div>
                <div className="border-b border-gray-200 pb-2">
                    <p className="text-xs font-bold uppercase text-gray-400 mb-1">Catégorie</p>
                    <p className="font-bold text-lg text-gray-800">{transaction.category || 'Non spécifié'}</p>
                </div>
                <div className="col-span-2 border-b border-gray-200 pb-2">
                    <p className="text-xs font-bold uppercase text-gray-400 mb-1">Description / Motif</p>
                    <p className="font-bold text-lg text-gray-800">{transaction.description}</p>
                </div>
                {transaction.reference && (
                    <div className="col-span-2 border-b border-gray-200 pb-2">
                        <p className="text-xs font-bold uppercase text-gray-400 mb-1">Référence Externe (Chèque, Virement...)</p>
                        <p className="font-bold text-lg text-gray-800">{transaction.reference}</p>
                    </div>
                )}
            </div>

            {/* Signatures */}
            <div className="mt-16 grid grid-cols-2 gap-12 pt-8 border-t-2 border-gray-100 break-inside-avoid">
                <div>
                    <p className="text-xs font-black uppercase text-gray-400 mb-8 tracking-widest">Signature {isDeposit ? 'Déposant' : 'Bénéficiaire'}</p>
                    <div className="h-px bg-gray-300 w-3/4"></div>
                </div>
                <div className="text-right">
                    <p className="text-xs font-black uppercase text-gray-400 mb-8 tracking-widest text-right">Signature Caissier / Comptable</p>
                    <div className="h-px bg-gray-300 w-3/4 ml-auto"></div>
                </div>
            </div>

            <div className="mt-12 text-center text-xs text-gray-300">
                <p>Document généré électroniquement par {settings?.companyName}</p>
            </div>
        </div>
    );
});

BankTransactionNote.displayName = 'BankTransactionNote';
