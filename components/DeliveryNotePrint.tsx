import React from 'react';
import { Sale, Customer, Product, AppSettings, Warehouse } from '../types';

interface DeliveryNoteProps {
    sale: Sale;
    customer: Customer | undefined;
    products: Product[];
    companyInfo: any;
    warehouse: Warehouse | undefined;
}

export const DeliveryNotePrint: React.FC<DeliveryNoteProps> = ({ sale, customer, products, companyInfo, warehouse }) => {
    return (
        <div id="delivery-note-zone" className="bg-white text-black p-8 font-sans" style={{ width: '210mm', minHeight: '297mm', margin: 'auto' }}>
            <header>
                <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center space-x-4">
                        {companyInfo.logoUrl && <img src={companyInfo.logoUrl} alt="Company Logo" className="h-20 w-auto" crossOrigin="anonymous" />}
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">{companyInfo.name}</h1>
                            <p className="text-sm text-gray-600">{companyInfo.address}</p>
                            <p className="text-sm text-gray-600">{companyInfo.phone}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-semibold text-gray-700 uppercase">Bon de Livraison</h2>
                        <p className="text-sm text-gray-500">BL #: {sale.referenceNumber.replace('INV', 'BL')}</p>
                        <p className="text-sm text-gray-500">Date: {new Date(sale.date).toLocaleDateString('fr-FR')}</p>
                        {warehouse && <p className="text-sm text-gray-500">Entrepôt: {warehouse.name}</p>}
                    </div>
                </div>

                <div className="mb-8 p-4 bg-gray-50 rounded-lg border">
                    <h3 className="font-semibold text-gray-700 mb-2">Destinataire</h3>
                    <p className="font-bold text-gray-800">{customer?.name || 'Client de passage'}</p>
                    <p className="text-sm text-gray-600">{customer?.phone}</p>
                    {customer?.address && <p className="text-sm text-gray-600">{customer.address}</p>}
                </div>
            </header>

            <main>
                <table className="w-full mb-8 text-sm border-collapse border border-gray-200">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="text-left font-bold p-3 border border-gray-200">Désignation</th>
                            <th className="text-center font-bold p-3 border border-gray-200 w-24">Quantité</th>
                            <th className="text-center font-bold p-3 border border-gray-200 w-32">Observation</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sale.items.map((item, index) => {
                            const product = products.find(p => p.id === item.productId);
                            return (
                                <tr key={index}>
                                    <td className="p-3 border border-gray-200">
                                        <div className="font-bold">{product?.name || 'Article Inconnu'}</div>
                                        {product?.sku && <div className="text-xs text-gray-500">{product.sku}</div>}
                                    </td>
                                    <td className="text-center p-3 border border-gray-200 font-bold text-lg">{item.quantity}</td>
                                    <td className="text-center p-3 border border-gray-200"></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <div className="mt-12 grid grid-cols-2 gap-8 text-sm">
                    <div className="border p-4 h-32">
                        <p className="font-bold underline mb-2">Signature Magasinier / Livreur :</p>
                    </div>
                    <div className="border p-4 h-32">
                        <p className="font-bold underline mb-2">Signature & Cachet Client :</p>
                        <p className="text-xs italic text-gray-500 mt-1">Reçu les marchandises en bon état.</p>
                    </div>
                </div>
            </main>

            <footer className="mt-auto pt-8 text-center text-xs text-gray-500">
                <p>Merci de votre confiance.</p>
            </footer>
        </div>
    );
};
