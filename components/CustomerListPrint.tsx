
import React from 'react';
import { Customer, AppSettings } from '../types';

interface CustomerListPrintProps {
    customers: Customer[];
    balances: Record<string, number>;
    settings: AppSettings | null;
}

export const CustomerListPrint = React.forwardRef<HTMLDivElement, CustomerListPrintProps>((props, ref) => {
    const { customers, balances, settings } = props;

    const formatCurrency = (val: number) => new Intl.NumberFormat('fr-FR').format(val).replace(/\u202f/g, ' ') + ' FCFA';
    const totalBalance = customers.reduce((sum, c) => sum + (balances[c.id] || 0), 0);

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
                    <h2 className="text-2xl font-black uppercase tracking-tighter">Liste des Clients</h2>
                    <p className="text-xs font-medium text-gray-500 mt-1">Date: {new Date().toLocaleDateString('fr-FR')}</p>
                    <p className="text-xs font-medium text-gray-500">Nombre de clients: {customers.length}</p>
                </div>
            </div>

            {/* Table */}
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-100 border-y border-gray-300">
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider w-10">#</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Client / Entreprise</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Contact</th>
                        <th className="py-2 px-2 text-left font-black uppercase tracking-wider">Ville</th>
                        <th className="py-2 px-2 text-right font-black uppercase tracking-wider">Plafond</th>
                        <th className="py-2 px-2 text-right font-black uppercase tracking-wider">Solde (Dette)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {customers.map((customer, index) => {
                        const balance = balances[customer.id] || 0;
                        const isExceeded = customer.isCreditLimited && customer.creditLimit && balance > customer.creditLimit;
                        
                        return (
                            <tr key={customer.id} className="break-inside-avoid">
                                <td className="py-2 px-2 text-gray-500">{index + 1}</td>
                                <td className="py-2 px-2">
                                    <div className="font-bold">{customer.businessName || customer.name}</div>
                                    {customer.businessName && <div className="text-[10px] text-gray-500 uppercase">{customer.name}</div>}
                                </td>
                                <td className="py-2 px-2">
                                    <div>{customer.phone || '-'}</div>
                                </td>
                                <td className="py-2 px-2 uppercase text-[10px]">{customer.city || '-'}</td>
                                <td className="py-2 px-2 text-right font-mono">
                                    {customer.isCreditLimited ? formatCurrency(customer.creditLimit || 0) : '-'}
                                </td>
                                <td className={`py-2 px-2 text-right font-mono font-bold ${isExceeded ? 'text-red-600' : ''}`}>
                                    {formatCurrency(balance)}
                                    {isExceeded && <span className="block text-[8px] text-red-600 uppercase">DÉPASSÉ</span>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-gray-800 bg-gray-50">
                        <td colSpan={5} className="py-3 px-2 text-right font-black uppercase tracking-widest">Total Créances</td>
                        <td className="py-3 px-2 text-right font-black text-sm">{formatCurrency(totalBalance)}</td>
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
