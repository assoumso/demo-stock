
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { Purchase, Supplier, Product, AppSettings } from '../types';
import { PrintIcon, ArrowLeftIcon, WhatsappIcon } from '../constants';

interface CompanyInfo {
    name: string;
    address: string;
    phone: string;
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
    const formatCurrency = (value: number) => new Intl.NumberFormat('fr-FR').format(value) + ` ${companyInfo.currencySymbol || 'FCFA'}`;
    const itemsSubtotal = purchase.items.reduce((sum, item) => sum + item.subtotal, 0);
    const remainingBalance = purchase.grandTotal - purchase.paidAmount;

    return (
        <div id="capture-zone" className="bg-white text-black p-8 font-sans invoice-template flex flex-col justify-between" style={{ width: '210mm', minHeight: '297mm', margin: 'auto' }}>
            <header>
                <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center space-x-4">
                        {companyInfo.logoUrl && <img src={companyInfo.logoUrl} alt="Company Logo" className="h-20 w-auto" crossOrigin="anonymous" />}
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">{companyInfo.name}</h1>
                            <p className="text-sm text-gray-600">{companyInfo.address}</p>
                            <p className="text-sm text-gray-600">{companyInfo.phone}{companyInfo.contact && ` / ${companyInfo.contact}`}</p>
                            {companyInfo.email && <p className="text-sm text-gray-600">{companyInfo.email}</p>}
                            {companyInfo.rccm && <p className="text-sm text-gray-600">RCCM: {companyInfo.rccm}</p>}
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-semibold text-gray-700">FACTURE D'ACHAT</h2>
                        <p className="text-sm text-gray-500">Référence #: {purchase.referenceNumber}</p>
                        <p className="text-sm text-gray-500">Date: {new Date(purchase.date).toLocaleDateString('fr-FR')}</p>
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
                                    <td className="p-3">{product?.name || 'Produit Inconnu'}</td>
                                    <td className="text-right p-3">{item.quantity}</td>
                                    <td className="text-right p-3">{formatCurrency(item.cost)}</td>
                                    <td className="text-right p-3">{formatCurrency(item.subtotal)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
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
    const [purchase, setPurchase] = useState<Purchase | null>(null);
    const [supplier, setSupplier] = useState<Supplier | undefined>(undefined);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
        name: 'ETS-DEMO',
        address: '',
        phone: '',
        email: '',
        contact: '',
        rccm: '',
        currencySymbol: 'FCFA'
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);

    useEffect(() => {
        const fetchInvoiceData = async () => {
            if (!id) {
                setError("ID de l'achat manquant.");
                setLoading(false);
                return;
            }

            try {
                const purchaseDocRef = doc(db, 'purchases', id);
                const purchaseSnap = await getDoc(purchaseDocRef);

                if (!purchaseSnap.exists()) {
                    setError("Facture d'achat introuvable.");
                    return;
                }

                const purchaseData = { id: purchaseSnap.id, ...purchaseSnap.data() } as Purchase;
                setPurchase(purchaseData);

                const [suppliersSnap, productsSnap, settingsSnap] = await Promise.all([
                    getDocs(collection(db, 'suppliers')),
                    getDocs(collection(db, 'products')),
                    getDoc(doc(db, 'settings', 'app-config'))
                ]);

                if (settingsSnap.exists()) {
                    const settingsData = settingsSnap.data() as AppSettings;
                    setCompanyInfo({
                        name: settingsData.companyName || 'ETS-DEMO',
                        address: settingsData.companyAddress || '',
                        phone: settingsData.companyPhone || '',
                        email: settingsData.companyEmail,
                        contact: settingsData.companyContact,
                        rccm: settingsData.companyRCCM,
                        currencySymbol: settingsData.currencySymbol || 'FCFA',
                        logoUrl: settingsData.companyLogoUrl,
                        footerText: settingsData.invoiceFooterText,
                    });
                }

                const suppliersList = suppliersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier));
                setSupplier(suppliersList.find(s => s.id === purchaseData.supplierId));

                setAllProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));

            } catch (err) {
                console.error("Error fetching invoice data:", err);
                setError("Impossible de charger les données de la facture.");
            } finally {
                setLoading(false);
            }
        };

        fetchInvoiceData();
    }, [id]);

    const formatCurrency = (value: number) => new Intl.NumberFormat('fr-FR').format(value) + ` ${companyInfo.currencySymbol || 'FCFA'}`;

    const handleShareWhatsapp = async () => {
        if (!purchase || !supplier?.phone) {
            alert("Numéro de téléphone du fournisseur manquant.");
            return;
        }
        
        setIsSharing(true);
        const element = document.getElementById('capture-zone');
        if (!element) return;

        try {
            // 1. Capture PDF
            const canvas = await (window as any).html2canvas(element, { scale: 2, useCORS: true, logging: false });
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = (window as any).jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            
            const pdfBlob = pdf.output('blob');
            const fileName = `Achat_${purchase.referenceNumber}.pdf`;
            const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

            // 2. Normalisation du numéro
            let cleanPhone = supplier.phone.replace(/\s+/g, '');
            if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.substring(2);
            if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.substring(1);
            if (cleanPhone.length >= 8 && cleanPhone.length <= 10 && !cleanPhone.startsWith('229')) {
                cleanPhone = '229' + cleanPhone;
            }

            const balance = purchase.grandTotal - purchase.paidAmount;
            const messageText = `*${companyInfo.name.toUpperCase()}*\n\nBonjour *${supplier.name}*,\n\nConcernant notre achat *${purchase.referenceNumber}*.\n\n- *Montant Total:* ${formatCurrency(purchase.grandTotal)}\n${balance > 0 ? `- *SOLDE À RÉGLER:* ${formatCurrency(balance)}` : '✅ *Règlement effectué*'}\n\nMerci.`;

            // 3. Partage ou Download
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                await navigator.share({ files: [pdfFile], title: fileName, text: messageText });
            } else {
                pdf.save(fileName);
                const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(messageText)}`;
                window.open(whatsappUrl, '_blank');
                alert("La facture a été téléchargée automatiquement. Joignez-la dans WhatsApp.");
            }
        } catch (err) {
            console.error(err);
            alert("Erreur génération PDF.");
        } finally {
            setIsSharing(false);
        }
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
                        onClick={handleShareWhatsapp}
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
                    products={allProducts}
                    companyInfo={companyInfo}
                />
            </main>
        </div>
    );
};

export default PurchaseInvoicePage;
