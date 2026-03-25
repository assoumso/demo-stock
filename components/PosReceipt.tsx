import React from 'react';
import { Sale, Customer, Product, AppSettings, Warehouse } from '../types';
import { formatCurrency } from '../utils/formatters';

interface PosReceiptProps {
    sale: Sale | null;
    customer: Customer | null;
    products: Product[];
    companyInfo: Partial<AppSettings>;
    warehouse: Warehouse | null;
    id?: string;
}

const PosReceipt = React.forwardRef<HTMLDivElement, PosReceiptProps>(
    ({ sale, customer, products, companyInfo, warehouse, id }, ref) => {
    
    if (!sale) return null;

    const getProductName = (productId: string) => {
        return products.find(p => p.id === productId)?.name || 'Produit inconnu';
    };

    return (
        <div id={id} ref={ref} className="bg-white text-black p-4 font-mono text-xs mx-auto" style={{ width: '80mm' }}>
            <div className="text-center">
                <img 
                    src={companyInfo.companyLogoUrl || '/logo.svg'} 
                    alt="Logo" 
                    className="mx-auto h-16 w-auto mb-2 object-contain"
                    crossOrigin="anonymous"
                />
                <h2 className="text-lg font-bold">{companyInfo.companyName || 'GROUP SYBA DISTRIBUTION & SERVICES'}</h2>
                <p>{companyInfo.companyAddress || 'Cotonou, Bénin'}</p>
                <p>{companyInfo.companyPhone || '+229 00 00 00 00'}</p>
            </div>
            
            <hr className="my-2 border-dashed border-black"/>
            
            <div className="flex justify-between">
                <span>Réf:</span>
                <span>{sale.referenceNumber}</span>
            </div>
            <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(sale.date).toLocaleString('fr-FR')}</span>
            </div>
            {warehouse && (
                 <div className="flex justify-between">
                    <span>Entrepôt:</span>
                    <span>{warehouse.name}</span>
                </div>
            )}
            {customer && (
                 <div className="flex justify-between">
                    <span>Client:</span>
                    <span>{customer.name}</span>
                </div>
            )}
            
            <hr className="my-2 border-dashed border-black"/>
            
            <table className="w-full">
                <thead>
                    <tr>
                        <th className="text-left">Article</th>
                        <th className="text-center">Qté</th>
                        <th className="text-right">Prix</th>
                        <th className="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {sale.items.map(item => (
                        <tr key={item.productId}>
                            <td className="text-left">{item.productName || getProductName(item.productId)}</td>
                            <td className="text-center">{item.quantity}</td>
                            <td className="text-right">{item.price.toLocaleString('fr-FR').replace(/\u202f/g, ' ')}</td>
                            <td className="text-right">{item.subtotal.toLocaleString('fr-FR').replace(/\u202f/g, ' ')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            <hr className="my-2 border-dashed border-black"/>

            <div className="flex justify-between font-bold">
                <span>TOTAL:</span>
                <span>{formatCurrency(sale.grandTotal)}</span>
            </div>
             <div className="flex justify-between">
                <span>Payé:</span>
                <span>{formatCurrency(sale.paidAmount)}</span>
            </div>
             {sale.paidAmount >= sale.grandTotal && (
                <div className="flex justify-between">
                    <span>Rendu:</span>
                    <span>{formatCurrency(sale.paidAmount - sale.grandTotal)}</span>
                </div>
            )}
            
            <div className="text-center mt-4">
                <p>{companyInfo.invoiceFooterText || "Merci de votre visite !"}</p>
            </div>
        </div>
    );
});

export default PosReceipt;
