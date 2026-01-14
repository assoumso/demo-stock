
import React, { useState, useEffect, useRef } from 'react';
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
    debit: number;  
    credit: number; 
    balance: number;
    type: 'sale' | 'payment' | 'opening';
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
                const custSnap = await getDoc(doc(db, 'customers', id));
                if (!custSnap.exists()) { navigate('/customers'); return; }
                const custData = { id: custSnap.id, ...custSnap.data() } as Customer;
                setCustomer(custData);

                const salesQuery = query(collection(db, "sales"), where("customerId", "==", id));
                const salesSnap = await getDocs(salesQuery);
                const salesDocs = salesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
                
                const saleIds = salesDocs.map(s => s.id);
                let allPayments: SalePayment[] = [];

                if (saleIds.length > 0) {
                    const pSnap = await getDocs(collection(db, "salePayments"));
                    allPayments = pSnap.docs
                        .map(d => ({ id: d.id, ...d.data() } as SalePayment))
                        .filter(p => saleIds.includes(p.saleId));
                }

                const combined: AccountMovement[] = [];
                
                // 0. Ajout du Solde d'Ouverture
                if (custData.openingBalance && custData.openingBalance > 0) {
                    combined.push({
                        date: custData.openingBalanceDate || new Date(0).toISOString(),
                        ref: 'OUV-001',
                        description: `Solde d'ouverture (Dette antérieure)`,
                        debit: custData.openingBalance,
                        credit: 0,
                        balance: 0,
                        type: 'opening'
                    });
                }

                salesDocs.forEach(s => {
                    combined.push({
                        date: s.date,
                        ref: s.referenceNumber,
                        description: `Facture de vente`,
                        debit: s.grandTotal,
                        credit: 0,
                        balance: 0,
                        type: 'sale'
                    });

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

                combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
                console.error("Erreur relevé:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAccountData();
    }, [id, navigate]);

    const useReactToPrint = (reactToPrint as any).useReactToPrint || reactToPrint;
    const handlePrint = useReactToPrint({ content: () => printRef.current });

    const formatCurrency = (v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' FCFA';

    if (loading) return <div className="p-12 text-center text-gray-500 font-bold animate-pulse">Génération du relevé...</div>;

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                <div className="flex items-center">
                    <button onClick={() => navigate('/customers')} className="p-3 mr-4 bg-white dark:bg-gray-800 rounded-full shadow-lg border dark:border-gray-700">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Fiche Compte Client</h1>
                        <p className="text-sm text-primary-600 font-black uppercase tracking-widest">{customer?.name}</p>
                    </div>
                </div>
                <button onClick={handlePrint} className="flex items-center px-6 py-3 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl">
                    <PrintIcon className="w-5 h-5 mr-2" /> Imprimer Relevé
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border-t-4 border-blue-500">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total dû (Factures + Ouverture)</p>
                    <p className="text-2xl font-black">{formatCurrency(summary.totalDue)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border-t-4 border-green-500">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total Encaissé</p>
                    <p className="text-2xl font-black text-green-600">{formatCurrency(summary.totalPaid)}</p>
                </div>
                <div className={`bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border-t-4 ${summary.balance > 0 ? 'border-red-500' : 'border-primary-500'}`}>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Solde Restant</p>
                    <p className={`text-2xl font-black ${summary.balance > 0 ? 'text-red-600' : 'text-primary-600'}`}>{formatCurrency(summary.balance)}</p>
                </div>
            </div>

            <div ref={printRef} className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border dark:border-gray-700 p-4 sm:p-10">
                <div className="hidden print:block mb-10 border-b-2 border-gray-900 pb-6 text-black">
                    <h2 className="text-3xl font-black uppercase">{customer?.businessName || customer?.name}</h2>
                    <p className="text-sm font-bold text-gray-500 uppercase">Extrait de compte au {new Date().toLocaleDateString('fr-FR')}</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-black dark:text-white">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th className="px-4 py-4 text-left text-[10px] font-black uppercase text-gray-500">Date</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black uppercase text-gray-500">Référence</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black uppercase text-gray-500">Désignation</th>
                                <th className="px-4 py-4 text-right text-[10px] font-black uppercase text-gray-500">Débit (+)</th>
                                <th className="px-4 py-4 text-right text-[10px] font-black uppercase text-gray-500 text-green-600">Crédit (-)</th>
                                <th className="px-4 py-4 text-right text-[10px] font-black uppercase text-gray-500 bg-gray-100 dark:bg-gray-700">Solde</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {movements.map((m, idx) => (
                                <tr key={idx} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${m.type === 'opening' ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                                    <td className="px-4 py-4 text-xs font-bold">{new Date(m.date).toLocaleDateString('fr-FR')}</td>
                                    <td className="px-4 py-4 text-xs font-black text-primary-600 uppercase">{m.ref}</td>
                                    <td className="px-4 py-4 text-xs font-medium">{m.description}</td>
                                    <td className="px-4 py-4 text-xs text-right font-bold">{m.debit > 0 ? formatCurrency(m.debit) : '-'}</td>
                                    <td className="px-4 py-4 text-xs text-right font-bold text-green-600">{m.credit > 0 ? formatCurrency(m.credit) : '-'}</td>
                                    <td className={`px-4 py-4 text-xs text-right font-black bg-gray-50/50 dark:bg-gray-900/20 ${m.balance > 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatCurrency(m.balance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CustomerAccountPage;
