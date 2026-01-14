
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Supplier, Purchase, Payment } from '../types';
import { ArrowLeftIcon, PrintIcon, TrendingUpIcon, WarningIcon } from '../constants';
import reactToPrint from 'react-to-print';

interface AccountMovement {
    date: string;
    ref: string;
    description: string;
    debit: number;  // Ce que nous payons (Paiements / Réduit la dette)
    credit: number; // Ce que nous devons (Achats / Augmente la dette)
    balance: number;
    type: 'purchase' | 'payment';
}

const SupplierAccountPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const printRef = useRef<HTMLDivElement>(null);

    const [supplier, setSupplier] = useState<Supplier | null>(null);
    const [loading, setLoading] = useState(true);
    const [movements, setMovements] = useState<AccountMovement[]>([]);
    const [summary, setSummary] = useState({ totalPurchased: 0, totalPaid: 0, balance: 0 });

    useEffect(() => {
        const fetchAccountData = async () => {
            if (!id) return;
            setLoading(true);
            try {
                // 1. Infos Fournisseur
                const supSnap = await getDoc(doc(db, 'suppliers', id));
                if (!supSnap.exists()) { navigate('/suppliers'); return; }
                setSupplier({ id: supSnap.id, ...supSnap.data() } as Supplier);

                // 2. Récupérer les Achats
                const purchasesQuery = query(collection(db, "purchases"), where("supplierId", "==", id));
                const purchasesSnap = await getDocs(purchasesQuery);
                const purchasesDocs = purchasesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase));
                
                const purchaseIds = purchasesDocs.map(p => p.id);
                let allPayments: Payment[] = [];

                // 3. Récupérer les Paiements enregistrés séparément (Règlements ultérieurs)
                if (purchaseIds.length > 0) {
                    const pSnap = await getDocs(collection(db, "purchasePayments"));
                    allPayments = pSnap.docs
                        .map(d => ({ id: d.id, ...d.data() } as Payment))
                        .filter(p => purchaseIds.includes(p.purchaseId));
                }

                // 4. Fusion chronologique pour le Grand Livre
                const combined: AccountMovement[] = [];
                
                purchasesDocs.forEach(p => {
                    // Ligne de l'Achat (Crédit : Augmente ce qu'on lui doit)
                    combined.push({
                        date: p.date,
                        ref: p.referenceNumber,
                        description: `Facture d'achat`,
                        debit: 0,
                        credit: p.grandTotal,
                        balance: 0,
                        type: 'purchase'
                    });

                    // IMPORTANT : Si l'achat a été réglé immédiatement (Comptant)
                    // on ajoute une ligne de Débit correspondante
                    if (p.paidAmount > 0) {
                        combined.push({
                            date: p.date,
                            ref: p.referenceNumber,
                            description: `Règlement initial effectué`,
                            debit: p.paidAmount,
                            credit: 0,
                            balance: 0,
                            type: 'payment'
                        });
                    }
                });

                // Ajouter les paiements ultérieurs (Règlements de factures)
                allPayments.forEach(pay => {
                    const parentPurchase = purchasesDocs.find(p => p.id === pay.purchaseId);
                    combined.push({
                        date: pay.date,
                        ref: `REG-${pay.id.slice(-4).toUpperCase()}`,
                        description: `Règlement facture ${parentPurchase?.referenceNumber || ''}`,
                        debit: pay.amount,
                        credit: 0,
                        balance: 0,
                        type: 'payment'
                    });
                });

                // Tri local par date
                combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                // 5. Calcul du solde progressif de la dette
                let runningBalance = 0;
                let tPurchased = 0;
                let tPaid = 0;
                const processed = combined.map(m => {
                    runningBalance += (m.credit - m.debit);
                    tPurchased += m.credit;
                    tPaid += m.debit;
                    return { ...m, balance: runningBalance };
                });

                setMovements(processed);
                setSummary({ totalPurchased: tPurchased, totalPaid: tPaid, balance: runningBalance });

            } catch (err) {
                console.error("Erreur de chargement du compte fournisseur:", err);
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

    if (loading) return <div className="p-12 text-center text-gray-500 font-bold animate-pulse">Analyse des flux fournisseur...</div>;

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                <div className="flex items-center">
                    <button onClick={() => navigate('/suppliers')} className="p-3 mr-4 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:scale-110 transition-transform border dark:border-gray-700">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Fiche Compte Fournisseur</h1>
                        <p className="text-sm text-red-600 font-black uppercase tracking-widest">{supplier?.name} {supplier?.businessName ? `(${supplier.businessName})` : ''}</p>
                    </div>
                </div>
                <button onClick={handlePrint} className="flex items-center px-6 py-3 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all shadow-xl">
                    <PrintIcon className="w-5 h-5 mr-2" /> Imprimer Grand Livre
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border-t-4 border-gray-400">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Facturé par Fournisseur</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(summary.totalPurchased)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border-t-4 border-green-500">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Payé (Décaissé)</p>
                    <p className="text-2xl font-black text-green-600">{formatCurrency(summary.totalPaid)}</p>
                </div>
                <div className={`bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border-t-4 ${summary.balance > 0 ? 'border-red-500' : 'border-blue-500'}`}>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Dette Actuelle</p>
                    <p className={`text-2xl font-black ${summary.balance > 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatCurrency(summary.balance)}</p>
                </div>
            </div>

            <div ref={printRef} className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border dark:border-gray-700 p-4 sm:p-10">
                <div className="hidden print:block mb-10 border-b-2 border-gray-900 pb-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-3xl font-black uppercase text-gray-900">{supplier?.businessName || supplier?.name}</h2>
                            <p className="text-gray-600 font-medium">Adresse: {supplier?.address || 'N/A'}</p>
                            <p className="text-gray-600 font-medium">Contact: {supplier?.phone} | {supplier?.email}</p>
                        </div>
                        <div className="text-right">
                            <h3 className="text-xl font-black underline uppercase">Extrait de Compte Fournisseur</h3>
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
                                <th className="px-4 py-4 text-right text-[10px] font-black uppercase text-green-600 tracking-widest">Débit (-)</th>
                                <th className="px-4 py-4 text-right text-[10px] font-black uppercase text-red-600 tracking-widest">Crédit (+)</th>
                                <th className="px-4 py-4 text-right text-[10px] font-black uppercase text-gray-500 tracking-widest bg-gray-100 dark:bg-gray-700">Solde Dette</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {movements.map((m, idx) => (
                                <tr key={idx} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${m.debit > 0 ? 'italic' : ''}`}>
                                    <td className="px-4 py-4 text-xs font-bold whitespace-nowrap">{new Date(m.date).toLocaleDateString('fr-FR')}</td>
                                    <td className="px-4 py-4 text-xs font-black text-primary-600 uppercase tracking-tighter">{m.ref}</td>
                                    <td className="px-4 py-4 text-xs text-gray-600 dark:text-gray-300 font-medium">
                                        {m.description}
                                        {m.description === 'Règlement initial effectué' && <span className="ml-2 text-[8px] px-1 bg-green-100 text-green-700 rounded uppercase font-black">Comptant</span>}
                                    </td>
                                    <td className="px-4 py-4 text-xs text-right font-bold text-green-600">{m.debit > 0 ? formatCurrency(m.debit) : '-'}</td>
                                    <td className="px-4 py-4 text-xs text-right font-bold text-red-600">{m.credit > 0 ? formatCurrency(m.credit) : '-'}</td>
                                    <td className={`px-4 py-4 text-xs text-right font-black bg-gray-50/50 dark:bg-gray-900/20 ${m.balance > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                        {formatCurrency(m.balance)}
                                    </td>
                                </tr>
                            ))}
                            {movements.length === 0 && (
                                <tr><td colSpan={6} className="py-24 text-center text-gray-400 font-black uppercase tracking-widest opacity-30">Aucun historique d'achat ou de paiement pour ce fournisseur</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="hidden print:grid grid-cols-2 gap-8 mt-12 pt-8 border-t-2 border-dashed border-gray-300">
                    <div className="text-center">
                        <p className="text-[10px] font-black uppercase mb-16 underline">Visa du Responsable Achats</p>
                    </div>
                    <div className="text-right">
                        <div className="mb-8">
                            <p className="text-lg font-black uppercase">Dette Arrêtée à: {formatCurrency(summary.balance)}</p>
                            <p className="text-[10px] font-bold text-gray-500 uppercase">{summary.balance > 0 ? 'Solde à régler' : 'Compte Fournisseur Apuré'}</p>
                        </div>
                        <p className="text-[10px] font-black uppercase underline">Cachet Direction ETS-YABABOU</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupplierAccountPage;
