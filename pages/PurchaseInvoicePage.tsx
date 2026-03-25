import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Purchase, Supplier, Product, AppSettings } from '../types';
import { PrintIcon, ArrowLeftIcon, WhatsappIcon } from '../constants';
import { formatCurrency as formatCurrencyUtil, formatDate } from '../utils/formatters';
import { shareInvoiceViaWhatsapp, normalizePhoneNumber } from '../utils/whatsappUtils';

import { useData } from '../context/DataContext';

interface CompanyInfo {
    name: string;
    address: string;
    phone: string;
    whatsapp?: string;
    email?: string;
    contact?: string;
    rccm?: string;
    logoUrl?: string;
    footerText?: string;
    currencySymbol: string;
}

interface InvoiceTemplateProps {
    purchase: Purchase;
    supplier: Supplier | undefined;
    products: Product[];
    companyInfo: CompanyInfo;
}

const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ purchase, supplier, products, companyInfo }) => {
    const formatCurrency = (value: number) => formatCurrencyUtil(value, companyInfo.currencySymbol || 'FCFA');
    const itemsSubtotal = purchase.items.reduce((sum, item) => sum + item.subtotal, 0);
    const remainingBalance = purchase.grandTotal - purchase.paidAmount;

    return (
        <div id="capture-zone" className="bg-white text-black p-8 font-sans invoice-template flex flex-col justify-between" style={{ width: '210mm', minHeight: '297mm', margin: 'auto' }}>
            <header>
                <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center space-x-4">
                        <img src={companyInfo.logoUrl || '/logo.png'} alt="Company Logo" className="h-20 w-auto" crossOrigin="anonymous" onError={(e) => e.currentTarget.style.display = 'none'} />
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">{companyInfo.name}</h1>
                            <p className="text-sm text-gray-600">{companyInfo.address}</p>
                            <p className="text-sm text-gray-600">{companyInfo.phone}</p>
                            {companyInfo.whatsapp && <p className="text-sm text-gray-600">WhatsApp: {companyInfo.whatsapp}</p>}
                            {companyInfo.email && <p className="text-sm text-gray-600">{companyInfo.email}</p>}
                            {companyInfo.rccm && <p className="text-sm text-gray-600">RCCM: {companyInfo.rccm}</p>}
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-semibold text-gray-700">FACTURE D'ACHAT</h2>
                        <p className="text-sm text-gray-500">Référence #: {purchase.referenceNumber}</p>
                        <p className="text-sm text-gray-500">Date: {formatDate(purchase.date)}</p>
                    </div>
                </div>

                <div className="mb-8 p-4 bg-gray-50 rounded-lg border">
                    <h3 className="font-semibold text-gray-700 mb-2">Fournisseur</h3>
                    <p className="font-bold text-gray-800">{supplier?.name || 'N/A'}</p>
                    <p className="text-sm text-gray-600">{supplier?.address}</p>
                    <p className="text-sm text-gray-600">{supplier?.phone} | {supplier?.email}</p>
                </div>
            </header>

            <main className="flex-grow">
                <table className="w-full mb-8 text-sm">
                    <thead>
                        <tr className="bg-gray-800 text-white">
                            <th className="text-left font-semibold p-3">Produit</th>
                            <th className="text-right font-semibold p-3">Quantité</th>
                            <th className="text-right font-semibold p-3">Coût Unitaire</th>
                            <th className="text-right font-semibold p-3">Sous-total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {purchase.items.map((item, index) => {
                            const product = products.find(p => p.id === item.productId);
                            return (
                                <tr key={index} className="border-b">
                                    <td className="p-3">{item.productName || product?.name || 'Produit Inconnu'}</td>
                                    <td className="text-right p-3">{item.quantity}</td>
                                    <td className="text-right p-3">{formatCurrency(item.cost)}</td>
                                    <td className="text-right p-3">{formatCurrency(item.subtotal)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-100 font-bold border-t-2 border-black">
                            <td className="p-3 text-right uppercase text-xs">Total</td>
                            <td className="p-3 text-right">{purchase.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                            <td></td>
                            <td className="p-3 text-right">{formatCurrency(purchase.items.reduce((sum, item) => sum + item.subtotal, 0))}</td>
                        </tr>
                    </tfoot>
                </table>
                 <div className="flex justify-end">
                    <div className="w-full md:w-1/2 lg:w-2/5">
                        <div className="flex justify-between py-2">
                            <span className="text-gray-600">Sous-total articles:</span>
                            <span className="font-semibold">{formatCurrency(itemsSubtotal)}</span>
                        </div>
                        <div className="flex justify-between py-2">
                            <span className="text-gray-600">Frais de livraison:</span>
                            <span className="font-semibold">{formatCurrency(purchase.shippingCost || 0)}</span>
                        </div>
                        <div className="flex justify-between py-3 border-t-2 mt-2">
                            <span className="font-bold text-lg">Total Général:</span>
                            <span className="font-bold text-lg">{formatCurrency(purchase.grandTotal)}</span>
                        </div>
                        <div className="flex justify-between py-2 text-green-600">
                            <span className="">Montant Payé:</span>
                            <span className="font-semibold">{formatCurrency(purchase.paidAmount)}</span>
                        </div>
                        <div className="flex justify-between py-2 text-red-600 bg-gray-100 p-2 rounded">
                            <span className="font-bold">Solde Restant:</span>
                            <span className="font-bold">{formatCurrency(remainingBalance)}</span>
                        </div>
                    </div>
                </div>

                {purchase.notes && (
                    <div className="mt-8 pt-4 border-t">
                        <h4 className="font-semibold mb-2">Notes:</h4>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{purchase.notes}</p>
                    </div>
                )}
            </main>

            <footer className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
                <p>{companyInfo.footerText}</p>
            </footer>
        </div>
    );
};

const PurchaseInvoicePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    const { suppliers, products, settings, loading: dataLoading } = useData();

    const [purchase, setPurchase] = useState<Purchase | null>(null);
    const [supplier, setSupplier] = useState<Supplier | undefined>(undefined);
    // Remove local products state as we use context
    
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
        name: '',
        address: '',
        phone: '',
        whatsapp: '',
        email: '',
        contact: '',
        rccm: '',
        currencySymbol: 'FCFA',
        logoUrl: '/logo.png'
    });
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    
    // Modal de partage
    const [showShareModal, setShowShareModal] = useState(false);
    const [sharePhoneNumber, setSharePhoneNumber] = useState('');

    // Effect 1: Fetch Purchase Data based on ID
    useEffect(() => {
        const fetchPurchase = async () => {
            if (!id) {
                setError("ID de l'achat manquant.");
                setLoading(false);
                return;
            }

            try {
                const { data, error: fetchError } = await supabase
                    .from('purchases')
                    .select('*')
                    .eq('id', id)
                    .single();
                
                if (fetchError || !data) {
                    setError("Facture d'achat introuvable.");
                    return;
                }
                setPurchase(data as Purchase);
            } catch (err) {
                console.error("Error fetching invoice data:", err);
                setError("Impossible de charger les détails de la facture.");
            } finally {
                setLoading(false);
            }
        };

        fetchPurchase();
    }, [id]);

    // Effect 2: Update Supplier and Company Info when dependencies change
    useEffect(() => {
        if (purchase && suppliers.length > 0) {
            setSupplier(suppliers.find(s => s.id === purchase.supplierId));
        }

        if (settings) {
            setCompanyInfo({
                name: settings.companyName || 'ETS COUL & FRERES',
                address: settings.companyAddress || 'Korhogo, Abidjan , lagune, BP 287, Côte d\'ivoire',
                phone: settings.companyPhone || '07-08-34-13-22',
                whatsapp: settings.companyWhatsapp,
                email: settings.companyEmail,
                contact: settings.companyContact,
                rccm: settings.companyRCCM,
                currencySymbol: settings.currencySymbol || 'FCFA',
                logoUrl: settings.companyLogoUrl || '/logo.png',
                footerText: settings.invoiceFooterText,
            });
        }
    }, [purchase, suppliers, settings]);

    const formatCurrency = (value: number) => formatCurrencyUtil(value, companyInfo.currencySymbol || 'FCFA');

    const openShareModal = () => {
        if (!purchase || !supplier) return;
        
        // Priorité: WhatsApp > Téléphone
        const target = supplier.whatsapp || supplier.phone;
        
        // On pré-remplit toujours le numéro et on ouvre le modal pour confirmation/modification
        setSharePhoneNumber(target || '');
        setShowShareModal(true);
    };

    const startDirectShare = async (phoneToUse: string) => {
        if (!purchase || !supplier) return;

        const cleanPhone = normalizePhoneNumber(phoneToUse);
        
        if (!cleanPhone || cleanPhone.length < 8) {
            alert("Numéro invalide. Veuillez corriger.");
            return;
        }

        setIsSharing(true);
        
        try {
            const balance = purchase.grandTotal - purchase.paidAmount;
            const messageText = `*${companyInfo.name.toUpperCase()}*\n\nBonjour *${supplier?.name}*,\n\nConcernant notre achat *${purchase.referenceNumber}*.\n\n- *Montant Total:* ${formatCurrencyUtil(purchase.grandTotal, companyInfo.currencySymbol)}\n${balance > 0 ? `- *SOLDE À RÉGLER:* ${formatCurrencyUtil(balance, companyInfo.currencySymbol)}` : '✅ *Règlement effectué*'}\n\nMerci.`;

            await shareInvoiceViaWhatsapp({
                elementId: 'capture-zone',
                filename: `Achat_${purchase.referenceNumber}.pdf`,
                phone: cleanPhone,
                message: messageText
            });
        } catch (err) {
            console.error(err);
            alert("Erreur génération PDF.");
        } finally {
            setIsSharing(false);
        }
    };

    const confirmShare = async () => {
        await startDirectShare(sharePhoneNumber);
        setShowShareModal(false);
    };

    if (loading) {
        return <div className="flex h-screen items-center justify-center">Chargement de la facture...</div>;
    }

    if (error) {
        return <div className="flex h-screen items-center justify-center text-red-500">{error}</div>;
    }

    if (!purchase) {
        return <div className="flex h-screen items-center justify-center">Facture non trouvée.</div>;
    }

    return (
        <div className="bg-gray-200 dark:bg-gray-900 min-h-screen invoice-page-container">
            <header className="no-print bg-white dark:bg-gray-800 p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
                <h1 className="text-lg font-semibold text-gray-800 dark:text-white">Achat : {purchase.referenceNumber}</h1>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => navigate('/purchases')}
                        className="flex items-center px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300"
                    >
                        <ArrowLeftIcon className="w-5 h-5 mr-2" />
                        Retour
                    </button>
                    <button
                        onClick={openShareModal}
                        disabled={isSharing}
                        className={`flex items-center px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 ${isSharing ? 'opacity-50' : ''}`}
                    >
                        {isSharing ? "Génération PDF..." : <><WhatsappIcon className="w-5 h-5 mr-2" /> Partager WhatsApp</>}
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="flex items-center px-4 py-2 text-sm text-white bg-primary-600 rounded-md hover:bg-primary-700"
                    >
                        <PrintIcon className="w-5 h-5 mr-2" />
                        Imprimer / PDF
                    </button>
                </div>
            </header>
            <main className="p-4 sm:p-8">
                <InvoiceTemplate
                    purchase={purchase}
                    supplier={supplier}
                    products={products}
                    companyInfo={companyInfo}
                />
            </main>

            {/* Modal de partage WhatsApp */}
            {showShareModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                            <WhatsappIcon className="w-6 h-6 mr-2 text-green-500" />
                            Partager la facture (Achat)
                        </h3>
                        
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Vérifiez le numéro du fournisseur. L'envoi se fera depuis <strong>votre</strong> compte WhatsApp actuel.
                        </p>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Numéro WhatsApp du Fournisseur
                            </label>
                            <input
                                type="tel"
                                value={sharePhoneNumber}
                                onChange={(e) => setSharePhoneNumber(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="ex: 229XXXXXXXX"
                            />
                            {sharePhoneNumber && (
                                <p className="text-xs text-gray-500 mt-2 flex items-center">
                                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                                    Format détecté : <span className="font-mono font-bold ml-1">+{normalizePhoneNumber(sharePhoneNumber)}</span>
                                </p>
                            )}
                        </div>
                        
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={confirmShare}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-lg hover:shadow-green-500/30 transition-all flex items-center"
                            >
                                <WhatsappIcon className="w-4 h-4 mr-2" />
                                Envoyer maintenant
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseInvoicePage;
