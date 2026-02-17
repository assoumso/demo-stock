import React from 'react';
import { CreditNote, AppSettings, Customer } from '../types';
import { formatCurrency } from '../utils/formatters';

interface CreditNoteListPrintProps {
    creditNotes: CreditNote[];
    customers: Customer[];
    settings: AppSettings | null;
    title?: string;
}

export const CreditNoteListPrint = React.forwardRef<HTMLDivElement, CreditNoteListPrintProps>((props, ref) => {
    const { creditNotes, customers, settings, title = 'Liste des Avoirs' } = props;

    const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || 'Client Inconnu';

    return (
        <div ref={ref} className="bg-white p-8 max-w-[297mm] mx-auto text-black font-sans text-xs" style={{ minHeight: '210mm' }}>
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
                    <p className="text-xs font-medium text-gray-500">Nombre d'avoirs: {creditNotes.length}</p>
                </div>
            </div>

            {/* Table */}
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-100 border-y border-gray-300">
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider w-10">#</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Référence</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Client</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Date</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Type</th>
                        <th className="py-2 px-2 text-right font-black uppercase tracking-wider">Montant</th>
                        <th className="py-2 px-2 text-center font-black uppercase tracking-wider">Statut</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {creditNotes.map((note, index) => (
                        <tr key={note.id || index} className="break-inside-avoid">
                            <td className="py-2 px-2 text-gray-500">{index + 1}</td>
                            <td className="py-2 px-2 font-mono font-bold">{note.referenceNumber}</td>
                            <td className="py-2 px-2">{getCustomerName(note.customerId)}</td>
                            <td className="py-2 px-2">{new Date(note.date).toLocaleDateString('fr-FR')}</td>
                            <td className="py-2 px-2 uppercase text-[10px]">{note.type === 'financial' ? 'Financier' : 'Retour Stock'}</td>
                            <td className="py-2 px-2 text-right font-mono font-bold">
                                {formatCurrency(note.total)}
                            </td>
                            <td className="py-2 px-2 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                    note.status === 'used' ? 'bg-green-100 text-green-800 border-green-200' :
                                    'bg-yellow-100 text-yellow-800 border-yellow-200'
                                }`}>
                                    {note.status === 'used' ? 'Utilisé' : 'Disponible'}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-300">
                    <tr className="bg-gray-50 font-bold">
                        <td colSpan={5} className="py-3 px-2 text-right uppercase">Total</td>
                        <td className="py-3 px-2 text-right font-mono">
                            {formatCurrency(creditNotes.reduce((sum, n) => sum + (n.total || 0), 0))}
                        </td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>

            {/* Footer */}
            <div className="fixed bottom-0 left-0 w-full text-center text-[10px] text-gray-400 p-4 bg-white print:block hidden">
                <p>Document généré le {new Date().toLocaleString('fr-FR')} par le système.</p>
            </div>
        </div>
    );
});
