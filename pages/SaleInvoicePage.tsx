
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Sale, Customer, Product, AppSettings, SalePayment, Warehouse } from '../types';
import { PrintIcon, ArrowLeftIcon, WhatsappIcon, DocumentTextIcon } from '../constants';
import { useReactToPrint } from 'react-to-print';
import { DeliveryNotePrint } from '../components/DeliveryNotePrint';

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
    sale: Sale;
    customer: Customer | undefined;
    products: Product[];
    companyInfo: CompanyInfo;
    payments: SalePayment[];
    warehouse: Warehouse | undefined;
}

const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ sale, customer, products, companyInfo, payments, warehouse }) => {
    const formatCurrency = (value: number) => new Intl.NumberFormat('fr-FR').format(value).replace(/\u202f/g, ' ') + ` ${companyInfo.currencySymbol || 'FCFA'}`;
    const itemsSubtotal = sale.items.reduce((sum, item) => sum + item.subtotal, 0);
    const remainingBalance = sale.grandTotal - sale.paidAmount;

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
                        <h2 className="text-2xl font-semibold text-gray-700">FACTURE DE VENTE</h2>
                        <p className="text-sm text-gray-500">Référence #: {sale.referenceNumber}</p>
                        <p className="text-sm text-gray-500">Date: {new Date(sale.date).toLocaleDateString('fr-FR')}</p>
                        {warehouse && <p className="text-sm text-gray-500">Entrepôt: {warehouse.name}</p>}
                    </div>
                </div>

                <div className="mb-8 p-4 bg-gray-50 rounded-lg border">
                    <h3 className="font-semibold text-gray-700 mb-2">Client</h3>
                    <p className="font-bold text-gray-800">{customer?.name || 'Client de passage'}</p>
                    <p className="text-sm text-gray-600">{customer?.phone} | {customer?.email}</p>
                    {customer?.address && <p className="text-sm text-gray-600">{customer.address}</p>}
                </div>
            </header>
            
            <main className="flex-grow">
                <table className="w-full mb-8 text-sm">
                    <thead>
                        <tr className="bg-gray-800 text-white">
                            <th className="text-left font-semibold p-3">Produit</th>
                            <th className="text-right font-semibold p-3">Quantité</th>
                            <th className="text-right font-semibold p-3">Prix Unitaire</th>
                            <th className="text-right font-semibold p-3">Sous-total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sale.items.map((item, index) => {
                            const product = products.find(p => p.id === item.productId);
                            return (
                                <tr key={index} className="border-b">
                                    <td className="p-3">{product?.name || 'Produit Inconnu'}</td>
                                    <td className="text-right p-3">{item.quantity}</td>
                                    <td className="text-right p-3">{formatCurrency(item.price)}</td>
                                    <td className="text-right p-3">{formatCurrency(item.subtotal)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                    <div className="w-full md:w-1/2">
                        {sale.notes && (
                            <div className="mb-6 p-4 bg-gray-50 rounded border">
                                <h4 className="font-semibold text-sm mb-2 text-gray-700">Notes / Observations:</h4>
                                <p className="text-sm text-gray-600 whitespace-pre-wrap">{sale.notes}</p>
                            </div>
                        )}

                        {payments.length > 0 && (
                            <div className="mb-6">
                                <h4 className="font-semibold text-sm mb-2 text-gray-700">Historique des Paiements:</h4>
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100 text-left">
                                            <th className="p-2 border-b">Date</th>
                                            <th className="p-2 border-b">Mode</th>
                                            <th className="p-2 border-b text-right">Montant</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payments.map(p => (
                                            <tr key={p.id} className="border-b last:border-0">
                                                <td className="p-2">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                                                <td className="p-2">{p.method}</td>
                                                <td className="p-2 text-right">{formatCurrency(p.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="w-full md:w-1/2 lg:w-2/5">
                        <div className="flex justify-between py-2">
                            <span className="text-gray-600">Sous-total articles:</span>
                            <span className="font-semibold">{formatCurrency(itemsSubtotal)}</span>
                        </div>
                        
                        <div className="flex justify-between py-3 border-t-2 mt-2">
                            <span className="font-bold text-lg">Total Général:</span>
                            <span className="font-bold text-lg">{formatCurrency(sale.grandTotal)}</span>
                        </div>
                        <div className="flex justify-between py-2 text-green-600">
                            <span className="">Montant Payé:</span>
                            <span className="font-semibold">{formatCurrency(sale.paidAmount)}</span>
                        </div>
                        <div className="flex justify-between py-2 text-red-600 bg-gray-100 p-2 rounded">
                            <span className="font-bold">Solde Restant:</span>
                            <span className="font-bold">{formatCurrency(remainingBalance)}</span>
                        </div>
                         {sale.paymentDueDate && remainingBalance > 0 && (
                            <div className="mt-2 text-right text-sm text-red-500 font-medium">
                                Échéance: {new Date(sale.paymentDueDate).toLocaleDateString('fr-FR')}
                            </div>
                        )}
                    </div>
                </div>
            </main>
            
            <footer className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
                <p>{companyInfo.footerText}</p>
            </footer>
        </div>
    );
};

const SaleInvoicePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [sale, setSale] = useState<Sale | null>(null);
    const [customer, setCustomer] = useState<Customer | undefined>(undefined);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [payments, setPayments] = useState<SalePayment[]>([]);
    const [warehouse, setWarehouse] = useState<Warehouse | undefined>(undefined);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
        name: 'ETS COULIBALY & FRERES',
        address: 'Korhogo, Abidjan , lagune, BP 287, Côte d\'ivoire',
        phone: '05 05 18 22 16 / 07 08 34 13 22',
        email: '',
        contact: '',
        rccm: '',
        currencySymbol: 'FCFA',
        logoUrl: '/logo.png'
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);

    // Delivery Note Logic
    const deliveryNoteRef = useRef<HTMLDivElement>(null);
    const handlePrintDeliveryNote = useReactToPrint({ contentRef: deliveryNoteRef });

    // Combined Print Logic
    const combinedRef = useRef<HTMLDivElement>(null);
    const handlePrintAll = useReactToPrint({ contentRef: combinedRef });

    useEffect(() => {
        const fetchInvoiceData = async () => {
            if (!id) {
                setError("ID de la vente manquant.");
                setLoading(false);
                return;
            }

            try {
                const saleDocRef = doc(db, 'sales', id);
                const saleSnap = await getDoc(saleDocRef);

                if (!saleSnap.exists()) {
                    setError("Facture de vente introuvable.");
                    return;
                }

                const saleData = { id: saleSnap.id, ...saleSnap.data() } as Sale;
                setSale(saleData);

                // Optimisation: Fetch ONLY related data
                const customerPromise = saleData.customerId 
                    ? getDoc(doc(db, 'customers', saleData.customerId))
                    : Promise.resolve(null);

                const productPromises = saleData.items.map(item => getDoc(doc(db, 'products', item.productId)));

                const [customerSnap, productsSnaps, settingsSnap, paymentsSnap, warehouseSnap] = await Promise.all([
                    customerPromise,
                    Promise.all(productPromises),
                    getDoc(doc(db, 'settings', 'app-config')),
                    getDocs(query(collection(db, 'salePayments'), where('saleId', '==', id))),
                    saleData.warehouseId ? getDoc(doc(db, 'warehouses', saleData.warehouseId)) : Promise.resolve(null)
                ]);

                if (settingsSnap.exists()) {
                    const settingsData = settingsSnap.data() as AppSettings;
                    setCompanyInfo({
                        name: settingsData.companyName || 'ETS COULIBALY & FRERES',
                        address: settingsData.companyAddress || 'Korhogo, Abidjan , lagune, BP 287, Côte d\'ivoire',
                        phone: settingsData.companyPhone || '05 05 18 22 16 / 07 08 34 13 22',
                        email: settingsData.companyEmail,
                        contact: settingsData.companyContact,
                        rccm: settingsData.companyRCCM,
                        currencySymbol: settingsData.currencySymbol || 'FCFA',
                        logoUrl: settingsData.companyLogoUrl || '/logo.png',
                        footerText: settingsData.invoiceFooterText,
                    });
                }

                if (customerSnap && customerSnap.exists()) {
                    setCustomer({ id: customerSnap.id, ...customerSnap.data() } as Customer);
                }

                const productsList = productsSnaps
                    .filter(p => p.exists())
                    .map(d => ({ id: d.id, ...d.data() } as Product));
                setAllProducts(productsList);

                const paymentsList = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as SalePayment));
                paymentsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setPayments(paymentsList);

                if (warehouseSnap && warehouseSnap.exists()) {
                    setWarehouse({ id: warehouseSnap.id, ...warehouseSnap.data() } as Warehouse);
                }

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
        if (!sale || !customer?.phone) {
            alert("Numéro de téléphone du client manquant.");
            return;
        }

        setIsSharing(true);
        const element = document.getElementById('capture-zone');
        if (!element) return;

        try {
            // 1. Capture de la facture en image puis PDF
            const canvas = await (window as any).html2canvas(element, { 
                scale: 2,
                useCORS: true,
                logging: false,
                windowWidth: 1200 
            });
            
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = (window as any).jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            const pdfBlob = pdf.output('blob');
            const fileName = `Facture_${sale.referenceNumber}.pdf`;
            const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

            // 2. Normalisation du numéro
            let cleanPhone = customer.phone.replace(/\s+/g, '');
            if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.substring(2);
            if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.substring(1);
            if (cleanPhone.length >= 8 && cleanPhone.length <= 10 && !cleanPhone.startsWith('229')) {
                cleanPhone = '229' + cleanPhone;
            }

            const balance = sale.grandTotal - sale.paidAmount;
            const messageText = `*${companyInfo.name.toUpperCase()}*\n\nBonjour *${customer.name}*,\n\nVoici votre facture *${sale.referenceNumber}*.\n\n- *Total:* ${formatCurrency(sale.grandTotal)}\n${balance > 0 ? `- *RESTE À PAYER:* ${formatCurrency(balance)}` : '✅ *Soldée*'}\n\nMerci !`;

            // 3. Partage Natif (Mobile) si supporté
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                await navigator.share({
                    files: [pdfFile],
                    title: fileName,
                    text: messageText,
                });
            } else {
                // 4. Fallback Desktop : Téléchargement + Ouverture WhatsApp
                pdf.save(fileName);
                const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(messageText)}`;
                window.open(whatsappUrl, '_blank');
                alert("La facture a été téléchargée. Veuillez la joindre dans la fenêtre WhatsApp qui vient de s'ouvrir.");
            }
        } catch (err) {
            console.error("Erreur lors du partage:", err);
            alert("Une erreur est survenue lors de la génération du PDF.");
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

    if (!sale) {
        return <div className="flex h-screen items-center justify-center">Facture non trouvée.</div>;
    }

    return (
        <div className="bg-gray-200 dark:bg-gray-900 min-h-screen invoice-page-container">
            <header className="no-print bg-white dark:bg-gray-800 p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
                <h1 className="text-lg font-semibold text-gray-800 dark:text-white">Facture : {sale.referenceNumber}</h1>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => navigate('/sales')}
                        className="flex items-center px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300"
                    >
                        <ArrowLeftIcon className="w-5 h-5 mr-2" />
                        Retour
                    </button>
                    <button
                        onClick={handleShareWhatsapp}
                        disabled={isSharing}
                        className={`flex items-center px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 ${isSharing ? 'opacity-50 cursor-wait' : ''}`}
                    >
                        {isSharing ? (
                            <span className="flex items-center"><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Préparation...</span>
                        ) : (
                            <><WhatsappIcon className="w-5 h-5 mr-2" /> Partager WhatsApp</>
                        )}
                    </button>
                    <button
                        onClick={() => handlePrintDeliveryNote()}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 bg-yellow-400 rounded-md hover:bg-yellow-500 font-bold"
                    >
                        <DocumentTextIcon className="w-5 h-5 mr-2" />
                        Bon de Livraison
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="flex items-center px-4 py-2 text-sm text-white bg-primary-600 rounded-md hover:bg-primary-700"
                    >
                        <PrintIcon className="w-5 h-5 mr-2" />
                        Imprimer Facture
                    </button>
                </div>
            </header>
            <main className="p-4 sm:p-8">
                <InvoiceTemplate
                    sale={sale}
                    customer={customer}
                    products={allProducts}
                    companyInfo={companyInfo}
                    payments={payments}
                    warehouse={warehouse}
                />
            </main>
            
            {/* Hidden Delivery Note Template for Printing */}
            <div className="hidden">
                <div ref={deliveryNoteRef}>
                    <DeliveryNotePrint
                        sale={sale}
                        customer={customer}
                        products={allProducts}
                        companyInfo={companyInfo}
                        warehouse={warehouse}
                    />
                </div>
                <div ref={combinedRef}>
                    <InvoiceTemplate
                        sale={sale}
                        customer={customer}
                        products={allProducts}
                        companyInfo={companyInfo}
                        payments={payments}
                        warehouse={warehouse}
                    />
                    <div style={{ pageBreakBefore: 'always' }} />
                    <DeliveryNotePrint
                        sale={sale}
                        customer={customer}
                        products={allProducts}
                        companyInfo={companyInfo}
                        warehouse={warehouse}
                    />
                </div>
            </div>
        </div>
    );
};

export default SaleInvoicePage;
