
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Customer, Sale, SalePayment } from '../types';
import { ArrowLeftIcon, PrintIcon, TrendingUpIcon, WarningIcon } from '../constants';
import reactToPrint from 'react-to-print';

interface AccountMovement {
    date: string;
    ref: string;
    description: string;
    debit: number;  // Ce que le client doit (Ventes)
    credit: number; // Ce que le client paie (Paiements)
    balance: number;
    type: 'sale' | 'payment';
}

const CustomerAccountPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const printRef = useRef<HTMLDivElement>(null);

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);
    const [movements, setMovements] = useState<AccountMovement[]>([]);
    const [summary, setSummary] = useState({ totalDue: 0, totalPaid: 0, balance: 0 });

    useEffect(() => {
        const fetchAccountData = async () => {
            if (!id) return;
            setLoading(true);
            try {
                // 1. Infos Client
                const custSnap = await getDoc(doc(db, 'customers', id));
                if (!custSnap.exists()) { navigate('/customers'); return; }
                setCustomer({ id: custSnap.id, ...custSnap.data() } as Customer);

                // 2. Récupérer les Ventes
                const salesQuery = query(collection(db, "sales"), where("customerId", "==", id));
                const salesSnap = await getDocs(salesQuery);
                const salesDocs = salesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
                
                const saleIds = salesDocs.map(s => s.id);
                let allPayments: SalePayment[] = [];

                // 3. Récupérer les Paiements enregistrés séparément
                if (saleIds.length > 0) {
                    const pSnap = await getDocs(collection(db, "salePayments"));
                    allPayments = pSnap.docs
                        .map(d => ({ id: d.id, ...d.data() } as SalePayment))
                        .filter(p => saleIds.includes(p.saleId));
                }

                // 4. Fusion chronologique pour le Grand Livre
                const combined: AccountMovement[] = [];
                
                salesDocs.forEach(s => {
                    // Ligne de la Facture (Débit : Augmente la dette)
                    combined.push({
                        date: s.date,
                        ref: s.referenceNumber,
                        description: `Facture de vente`,
                        debit: s.grandTotal,
                        credit: 0,
                        balance: 0,
                        type: 'sale'
                    });

                    // IMPORTANT : Si la vente a été payée immédiatement (Espèces/POS)
                    // on ajoute une ligne de Crédit correspondante
                    if (s.paidAmount > 0) {
                        combined.push({
                            date: s.date,
                            ref: s.referenceNumber,
                            description: `Paiement initial reçu`,
                            debit: 0,
                            credit: s.paidAmount,
                            balance: 0,
                            type: 'payment'
                        });
                    }
                });

                // Ajouter les paiements ultérieurs (Règlements de factures)
                allPayments.forEach(p => {
                    const parentSale = salesDocs.find(s => s.id === p.saleId);
                    combined.push({
                        date: p.date,
                        ref: `REG-${p.id.slice(-4).toUpperCase()}`,
                        description: `Règlement facture ${parentSale?.referenceNumber || ''}`,
                        debit: 0,
                        credit: p.amount,
                        balance: 0,
                        type: 'payment'
                    });
                });

                // Tri global par date
                combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                // 5. Calcul du solde progressif
                let runningBalance = 0;
                let tDue = 0;
                let tPaid = 0;
                const processed = combined.map(m => {
                    runningBalance += (m.debit - m.credit);
                    tDue += m.debit;
                    tPaid += m.credit;
                    return { ...m, balance: runningBalance };
                });

                setMovements(processed);
                setSummary({ totalDue: tDue, totalPaid: tPaid, balance: runningBalance });

            } catch (err) {
                console.error("Erreur de chargement du compte:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAccountData();
    }, [id, navigate]);

    const useReactToPrint = (reactToPrint as any).useReactToPrint || reactToPrint;
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
    });

    const formatCurrency = (v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' FCFA';

    if (loading) return <div className="p-12 text-center text-gray-500 font-bold animate-pulse">Génération du relevé en cours...</div>;

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                <div className="flex items-center">
                    <button onClick={() => navigate('/customers')} className="p-3 mr-4 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:scale-110 transition-transform border dark:border-gray-700">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Fiche Compte Client</h1>
                        <p className="text-sm text-primary-600 font-black uppercase tracking-widest">{customer?.name} {customer?.businessName ? `(${customer.businessName})` : ''}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handlePrint} className="flex items-center px-6 py-3 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all shadow-xl">
                        <PrintIcon className="w-5 h-5 mr-2" /> Imprimer Relevé
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border-t-4 border-blue-500">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Facturé (Débit)</p>
                        <TrendingUpIcon className="w-5 h-5 text-blue-500 opacity-50" />
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(summary.totalDue)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border-t-4 border-green-500">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Encaissé (Crédit)</p>
                        <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center"><div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div></div>
                    </div>
                    <p className="text-2xl font-black text-green-600">{formatCurrency(summary.totalPaid)}</p>
                </div>
                <div className={`bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border-t-4 ${summary.balance > 0 ? 'border-red-500' : 'border-primary-500'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Reste à Recouvrer</p>
                        {summary.balance > 0 ? <WarningIcon className="w-5 h-5 text-red-500" /> : <div className="text-primary-500 font-bold uppercase text-[10px]">Compte Soldé</div>}
                    </div>
                    <p className={`text-2xl font-black ${summary.balance > 0 ? 'text-red-600' : 'text-primary-600'}`}>{formatCurrency(summary.balance)}</p>
                </div>
            </div>

            <div ref={printRef} className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border dark:border-gray-700 p-4 sm:p-10">
                <div className="hidden print:block mb-10 border-b-2 border-gray-900 pb-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-3xl font-black uppercase text-gray-900">{customer?.businessName || customer?.name}</h2>
                            <p className="text-gray-600 font-medium">Adresse: {customer?.address || 'N/A'}, {customer?.city || ''}</p>
                            <p className="text-gray-600 font-medium">Contact: {customer?.phone} | {customer?.email}</p>
                        </div>
                        <div className="text-right">
                            <h3 className="text-xl font-black underline uppercase">Extrait de Compte Client</h3>
                            <p className="text-sm font-bold text-gray-500">Date d'édition: {new Date().toLocaleDateString('fr-FR')}</p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th className="px-4 py-4 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">Date</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">Référence</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">Désignation</th>
                                <th className="px-4 py-4 text-right text-[10px] font-black uppercase text-gray-500 tracking-widest">Débit (+)</th>
                                <th className="px-4 py-4 text-right text-[10px] font-black uppercase text-gray-500 tracking-widest text-green-600">Crédit (-)</th>
                                <th className="px-4 py-4 text-right text-[10px] font-black uppercase text-gray-500 tracking-widest bg-gray-100 dark:bg-gray-700">Solde</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {movements.map((m, idx) => (
                                <tr key={idx} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${m.type === 'payment' ? 'italic' : ''}`}>
                                    <td className="px-4 py-4 text-xs font-bold whitespace-nowrap">{new Date(m.date).toLocaleDateString('fr-FR')}</td>
                                    <td className="px-4 py-4 text-xs font-black text-primary-600 uppercase tracking-tighter">{m.ref}</td>
                                    <td className="px-4 py-4 text-xs text-gray-600 dark:text-gray-300 font-medium">
                                        {m.description}
                                        {m.description === 'Paiement initial reçu' && <span className="ml-2 text-[8px] px-1 bg-green-100 text-green-700 rounded uppercase font-black">Comptant</span>}
                                    </td>
                                    <td className="px-4 py-4 text-xs text-right font-bold text-gray-900 dark:text-white">{m.debit > 0 ? formatCurrency(m.debit) : '-'}</td>
                                    <td className="px-4 py-4 text-xs text-right font-bold text-green-600">{m.credit > 0 ? formatCurrency(m.credit) : '-'}</td>
                                    <td className={`px-4 py-4 text-xs text-right font-black bg-gray-50/50 dark:bg-gray-900/20 ${m.balance > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                        {formatCurrency(m.balance)}
                                    </td>
                                </tr>
                            ))}
                            {movements.length === 0 && (
                                <tr><td colSpan={6} className="py-24 text-center text-gray-400 font-black uppercase tracking-widest opacity-30">Aucun historique de mouvement pour ce compte</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="hidden print:grid grid-cols-2 gap-8 mt-12 pt-8 border-t-2 border-dashed border-gray-300">
                    <div className="text-center">
                        <p className="text-[10px] font-black uppercase mb-16 underline">Visa du Client</p>
                        <p className="text-[8px] text-gray-400 italic">"Reconnais avoir pris connaissance du solde arrêté au {new Date().toLocaleDateString('fr-FR')}"</p>
                    </div>
                    <div className="text-right">
                        <div className="mb-8">
                            <p className="text-lg font-black uppercase">Solde Débiteur: {formatCurrency(summary.balance)}</p>
                            <p className="text-[10px] font-bold text-gray-500 uppercase">{summary.balance > 0 ? 'Reste à payer' : 'Compte en règle'}</p>
                        </div>
                        <p className="text-[10px] font-black uppercase underline">Signature et Cachet ETS-YABABOU</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerAccountPage;
