import React from 'react';
import { WarehouseTransfer, Product, AppSettings } from '../types';

interface TransferNoteProps {
    transfer: WarehouseTransfer;
    fromWarehouseName: string;
    toWarehouseName: string;
    products: Product[];
    settings: AppSettings | null;
}

export const TransferNote = React.forwardRef<HTMLDivElement, TransferNoteProps>(({ transfer, fromWarehouseName, toWarehouseName, products, settings }, ref) => {
    const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'Produit Inconnu';
    const getProductSku = (id: string) => products.find(p => p.id === id)?.sku || '-';

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const logoSource = settings?.companyLogoUrl || '/logo.png';

    return (
        <div ref={ref} className="p-8 max-w-4xl mx-auto bg-white text-gray-900 font-sans" style={{ minHeight: '297mm' }}>
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
                <div>
                    <img src={logoSource} alt="Logo" className="h-24 w-auto object-contain mb-3" />
                    <h1 className="text-xl font-bold uppercase tracking-tight text-gray-900 mb-1">{settings?.companyName}</h1>
                    <div className="text-sm space-y-1 text-gray-600">
                        <p>{settings?.companyAddress}</p>
                        <p>{settings?.companyPhone} {settings?.companyEmail ? `| ${settings.companyEmail}` : ''}</p>
                        {settings?.companyRCCM && <p>RCCM: {settings.companyRCCM}</p>}
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-4xl font-black uppercase tracking-widest text-gray-900 mb-2">BON DE TRANSFERT</h2>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Réf: {transfer.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-sm font-bold text-gray-500 mt-1">{formatDate(transfer.date)}</p>
                </div>
            </div>

            {/* Transfer Info Grid */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h3 className="text-xs font-black uppercase text-gray-400 mb-2 tracking-widest">Origine</h3>
                    <p className="text-xl font-bold text-gray-900">{fromWarehouseName}</p>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <h3 className="text-xs font-black uppercase text-gray-400 mb-1 tracking-widest">Chauffeur / Transporteur</h3>
                        <p className="font-bold text-gray-800">{transfer.driverName || 'Non spécifié'}</p>
                    </div>
                </div>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h3 className="text-xs font-black uppercase text-gray-400 mb-2 tracking-widest">Destination</h3>
                    <p className="text-xl font-bold text-gray-900">{toWarehouseName}</p>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <h3 className="text-xs font-black uppercase text-gray-400 mb-1 tracking-widest">Statut</h3>
                        <span className="inline-block px-3 py-1 bg-white border border-gray-200 rounded text-sm font-bold uppercase">
                            {transfer.status}
                        </span>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="mb-8">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b-2 border-gray-800">
                            <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500">Désignation</th>
                            <th className="py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500">SKU</th>
                            <th className="py-3 text-right text-xs font-black uppercase tracking-widest text-gray-500">Quantité</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {transfer.items && transfer.items.length > 0 ? (
                            transfer.items.map((item, index) => (
                                <tr key={index}>
                                    <td className="py-3 font-bold text-gray-800">{getProductName(item.productId)}</td>
                                    <td className="py-3 text-sm text-gray-600">{getProductSku(item.productId)}</td>
                                    <td className="py-3 text-right font-bold text-lg">{item.quantity}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td className="py-3 font-bold text-gray-800">{transfer.productId ? getProductName(transfer.productId) : 'N/A'}</td>
                                <td className="py-3 text-sm text-gray-600">{transfer.productId ? getProductSku(transfer.productId) : '-'}</td>
                                <td className="py-3 text-right font-bold text-lg">{transfer.quantity || 0}</td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-800">
                        <tr>
                            <td colSpan={2} className="py-4 px-4 text-right font-black uppercase tracking-widest text-sm">Total Articles</td>
                            <td className="py-4 text-right font-black text-xl pr-1">
                                {transfer.items 
                                    ? transfer.items.reduce((sum, item) => sum + item.quantity, 0)
                                    : (transfer.quantity || 0)
                                }
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Footer / Signatures */}
            <div className="mt-16 grid grid-cols-2 gap-12 pt-8 border-t border-gray-200 break-inside-avoid">
                <div>
                    <p className="text-xs font-black uppercase text-gray-400 mb-8 tracking-widest">Visa Expéditeur / Magasinier</p>
                    <div className="h-px bg-gray-300 w-3/4"></div>
                </div>
                <div>
                    <p className="text-xs font-black uppercase text-gray-400 mb-8 tracking-widest">Visa Réceptionnaire / Chauffeur</p>
                    <div className="h-px bg-gray-300 w-3/4"></div>
                </div>
            </div>

            <div className="mt-12 text-center text-xs text-gray-400">
                <p>Ce document sert de justificatif de mouvement de stock. Merci de le conserver.</p>
                <p className="mt-1">Généré le {new Date().toLocaleString('fr-FR')}</p>
            </div>
        </div>
    );
});

TransferNote.displayName = 'TransferNote';
