import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, where, runTransaction, DocumentData } from 'firebase/firestore';
import { Supplier, Purchase, Payment, PaymentMethod, PaymentStatus, DeletedPurchasePayment } from '../types';
import { ArrowLeftIcon, PrintIcon, TrendingUpIcon, WarningIcon, PaymentIcon, DeleteIcon } from '../constants';
import { useReactToPrint } from 'react-to-print';
import Modal from '../components/Modal';
import { useAuth } from '../hooks/useAuth';

interface AccountMovement {
    id?: string;
    purchaseId?: string;
    date: string;
    ref: string;
    description: string;
    debit: number;  // Ce que nous payons
    credit: number; // Ce que nous devons
    balance: number;
    type: 'purchase' | 'payment' | 'opening';
}

const SupplierAccountPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const printRef = useRef<HTMLDivElement>(null);

    const [supplier, setSupplier] = useState<Supplier | null>(null);
    const [loading, setLoading] = useState(true);
    const [movements, setMovements] = useState<AccountMovement[]>([]);
    const [summary, setSummary] = useState({ totalPurchased: 0, totalPaid: 0, balance: 0 });
    const [unpaidPurchases, setUnpaidPurchases] = useState<Purchase[]>([]);

    // Modal
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Espèces');
    const [momoOperator, setMomoOperator] = useState('');
    const [momoNumber, setMomoNumber] = useState('');
    const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Delete Modal
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [paymentToDelete, setPaymentToDelete] = useState<{id: string, amount: number, purchaseId: string} | null>(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchAccountData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const supSnap = await getDoc(doc(db, 'suppliers', id));
            if (!supSnap.exists()) { navigate('/suppliers'); return; }
            const supplierData = { id: supSnap.id, ...supSnap.data() } as Supplier;
            setSupplier(supplierData);

            const purchasesQuery = query(collection(db, "purchases"), where("supplierId", "==", id));
            const purchasesSnap = await getDocs(purchasesQuery);
            const purchasesDocs = purchasesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase));
            
            const purchaseIds = purchasesDocs.map(p => p.id);
            let allPayments: Payment[] = [];

            if (purchaseIds.length > 0) {
                const pSnap = await getDocs(collection(db, "purchasePayments"));
                allPayments = pSnap.docs
                    .map(d => ({ id: d.id, ...d.data() } as Payment))
                    .filter(p => purchaseIds.includes(p.purchaseId));
            }

            const combined: AccountMovement[] = [];

            // 1. Solde d'ouverture (Dette initiale)
            if (supplierData.openingBalance && supplierData.openingBalance > 0) {
                combined.push({
                    date: supplierData.openingBalanceDate || new Date(0).toISOString(),
                    ref: 'OUV-INI',
                    description: `SOLDE D'OUVERTURE (DETTE INITIALE)`,
                    debit: 0,
                    credit: supplierData.openingBalance,
                    balance: 0,
                    type: 'opening'
                });
            }
            
            purchasesDocs.forEach(p => {
                combined.push({
                    date: p.date,
                    ref: p.referenceNumber,
                    description: `Facture d'achat`,
                    debit: 0,
                    credit: p.grandTotal,
                    balance: 0,
                    type: 'purchase'
                });

                const paymentsForPurchase = allPayments.filter(pay => pay.purchaseId === p.id);
                const sumPaymentsDocs = paymentsForPurchase.reduce((sum, pay) => sum + pay.amount, 0);

                if (p.paidAmount > sumPaymentsDocs + 1) {
                    combined.push({
                        date: p.date,
                        ref: p.referenceNumber,
                        description: `Règlement enregistré sur facture (Acompte)`,
                        debit: p.paidAmount - sumPaymentsDocs,
                        credit: 0,
                        balance: 0,
                        type: 'payment'
                    });
                }
            });

            allPayments.forEach(pay => {
                const parentPurchase = purchasesDocs.find(p => p.id === pay.purchaseId);
                combined.push({
                    id: pay.id,
                    purchaseId: pay.purchaseId,
                    date: pay.date,
                    ref: `REG-${pay.id.slice(-4).toUpperCase()}`,
                    description: `Règlement facture ${parentPurchase?.referenceNumber || ''}`,
                    debit: pay.amount,
                    credit: 0,
                    balance: 0,
                    type: 'payment'
                });
            });

            combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
            
            const unpaid = purchasesDocs.filter(p => p.paymentStatus !== 'Payé');
            setUnpaidPurchases(unpaid.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
            if(unpaid.length > 0) setSelectedPurchaseId(unpaid[0].id);

        } catch (err) {
            console.error("Erreur relevé:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAccountData(); }, [id, navigate]);

    const handleDeletePayment = (m: AccountMovement) => {
        if (!m.id || !m.purchaseId) return;
        setPaymentToDelete({ id: m.id, amount: m.debit, purchaseId: m.purchaseId });
        setDeleteReason('');
        setDeleteModalOpen(true);
    };

    const confirmDeletePayment = async () => {
        if (!paymentToDelete || !user) return;
        if (!deleteReason.trim()) {
            alert("Veuillez saisir un motif de suppression.");
            return;
        }

        setIsDeleting(true);
        try {
            await runTransaction(db, async (transaction) => {
                const { id: paymentId } = paymentToDelete;
                const paymentRef = doc(db, "purchasePayments", paymentId);
                const paymentSnap = await transaction.get(paymentRef);
                if (!paymentSnap.exists()) throw new Error("Paiement introuvable");
                
                const paymentData = paymentSnap.data() as Payment;
                const { purchaseId, amount } = paymentData;

                // Update purchase balance
                const purchaseRef = doc(db, "purchases", purchaseId);
                const purchaseSnap = await transaction.get(purchaseRef);
                if (purchaseSnap.exists()) {
                    const purchaseData = purchaseSnap.data() as Purchase;
                    const newPaid = Math.max(0, (purchaseData.paidAmount || 0) - amount);
                    const remaining = purchaseData.grandTotal - newPaid;
                    
                    let newStatus: PaymentStatus = 'En attente';
                    if (newPaid >= purchaseData.grandTotal - 0.1) newStatus = 'Payé';
                    else if (newPaid > 0.1) newStatus = 'Partiel';
                    
                    transaction.update(purchaseRef, { paidAmount: newPaid, paymentStatus: newStatus });
                }

                // Store audit trail
                const deletedPaymentRef = doc(collection(db, "deleted_purchasePayments"));
                const deletedPaymentData: DeletedPurchasePayment = {
                    originalPayment: paymentData,
                    deletedAt: new Date().toISOString(),
                    deletedBy: user.uid,
                    deleteReason: deleteReason
                };
                transaction.set(deletedPaymentRef, deletedPaymentData);

                // Delete original payment
                transaction.delete(paymentRef);
            });

            await fetchAccountData();
            setDeleteModalOpen(false);
            setPaymentToDelete(null);
            setDeleteReason('');
        } catch (err: any) {
            alert("Erreur lors de la suppression : " + err.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleQuickPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || paymentAmount <= 0 || !selectedPurchaseId) return;

        if (paymentMethod === 'Mobile Money' && (!momoOperator || !momoNumber)) {
            setError("Opérateur et numéro requis pour Mobile Money.");
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            await runTransaction(db, async (transaction) => {
                const pRef = doc(db, 'purchases', selectedPurchaseId);
                const pSnap = await transaction.get(pRef);
                const data = pSnap.data() as Purchase;
                const newPaid = data.paidAmount + paymentAmount;
                const remaining = data.grandTotal - newPaid;
                if (remaining < -0.1) throw new Error("Le montant dépasse le solde restant.");
                let status: PaymentStatus = remaining <= 0.1 ? 'Payé' : 'Partiel';
                
                transaction.update(pRef, { paidAmount: newPaid, paymentStatus: status });
                
                const payData: any = {
                    purchaseId: selectedPurchaseId,
                    date: new Date().toISOString(),
                    amount: paymentAmount,
                    method: paymentMethod,
                    createdByUserId: user.uid,
                    notes: paymentNotes
                };

                if (paymentMethod === 'Mobile Money') {
                    payData.momoOperator = momoOperator;
                    payData.momoNumber = momoNumber;
                }

                transaction.set(doc(collection(db, "purchasePayments")), payData);
            });
            setIsPaymentModalOpen(false);
            setPaymentAmount(0);
            setPaymentNotes('');
            setMomoOperator('');
            setMomoNumber('');
            fetchAccountData();
        } catch (err: any) { setError(err.message); }
        finally { setIsSubmitting(false); }
    };

    const handlePrint = useReactToPrint({ contentRef: printRef });

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
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="flex items-center px-6 py-3 bg-red-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-red-700 transition-all"
                    >
                        <PaymentIcon className="w-5 h-5 mr-2" /> Payer le fournisseur
                    </button>
                    <button onClick={handlePrint} className="flex items-center px-6 py-3 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all shadow-xl">
                        <PrintIcon className="w-5 h-5 mr-2" /> Imprimer Grand Livre
                    </button>
                </div>
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
                <div className="hidden print:block mb-10 border-b-2 border-gray-900 pb-6 text-black">
                     <div className="mb-8 text-center">
                        <h1 className="text-2xl font-black uppercase">ETS COULIBALY & FRERES</h1>
                        <p className="text-sm">Korhogo, Abidjan , lagune, BP 287, Côte d'ivoire</p>
                        <p className="text-sm">05 05 18 22 16 / 07 08 34 13 22</p>
                     </div>
                     <h2 className="text-3xl font-black uppercase">{supplier?.businessName || supplier?.name}</h2>
                     <p className="text-sm font-bold text-gray-500 uppercase">Extrait de compte au {new Date().toLocaleDateString('fr-FR')}</p>
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
                                <th className="w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {movements.map((m, idx) => (
                                <tr key={idx} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${m.type === 'opening' ? 'bg-red-50 dark:bg-red-900/10' : m.debit > 0 ? 'italic' : ''}`}>
                                    <td className="px-4 py-4 text-xs font-bold whitespace-nowrap">{new Date(m.date).toLocaleDateString('fr-FR')}</td>
                                    <td className="px-4 py-4 text-xs font-black text-primary-600 uppercase tracking-tighter">{m.ref}</td>
                                    <td className="px-4 py-4 text-xs text-gray-600 dark:text-gray-300 font-medium">{m.description}</td>
                                    <td className="px-4 py-4 text-xs text-right font-bold text-green-600">{m.debit > 0 ? formatCurrency(m.debit) : '-'}</td>
                                    <td className="px-4 py-4 text-xs text-right font-bold text-red-600">{m.credit > 0 ? formatCurrency(m.credit) : '-'}</td>
                                    <td className={`px-4 py-4 text-xs text-right font-black bg-gray-50/50 dark:bg-gray-900/20 ${m.balance > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                        {formatCurrency(m.balance)}
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        {m.type === 'payment' && m.id && (
                                            <button onClick={() => handleDeletePayment(m)} className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-lg hover:bg-red-50">
                                                <DeleteIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Payer le fournisseur">
                <form onSubmit={handleQuickPayment} className="p-6 space-y-4">
                    {error && <div className="p-3 bg-red-100 text-red-700 rounded-xl text-xs font-bold">{error}</div>}
                    <div>
                        <label className="block text-xs font-black uppercase text-gray-400 mb-1">Achat à solder</label>
                        <select 
                            value={selectedPurchaseId} 
                            onChange={(e) => setSelectedPurchaseId(e.target.value)}
                            required
                            className="w-full p-3 border rounded-xl dark:bg-gray-700 font-bold"
                        >
                            {unpaidPurchases.map(p => (
                                <option key={p.id} value={p.id}>{p.referenceNumber} - Reste: {formatCurrency(p.grandTotal - p.paidAmount)}</option>
                            ))}
                            {unpaidPurchases.length === 0 && <option disabled>Aucun achat impayé</option>}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase text-gray-400 mb-1">Montant du versement</label>
                        <input 
                            type="number" 
                            required 
                            min="1"
                            value={paymentAmount || ''} 
                            onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)}
                            className="w-full p-3 border rounded-xl dark:bg-gray-700 text-xl font-black text-red-600 focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase text-gray-400 mb-1">Mode de règlement</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {['Espèces', 'Virement bancaire', 'Mobile Money', 'Autre'].map(m => (
                                <button key={m} type="button" onClick={() => { setPaymentMethod(m as PaymentMethod); if(m !== 'Mobile Money') { setMomoOperator(''); setMomoNumber(''); } }} className={`py-2 rounded-xl text-[10px] font-bold uppercase border-2 ${paymentMethod === m ? 'bg-gray-900 text-white border-gray-900' : 'bg-white dark:bg-gray-700 text-gray-500 border-gray-100 dark:border-gray-600 hover:border-gray-200'}`}>{m}</button>
                            ))}
                        </div>
                    </div>
                    {paymentMethod === 'Mobile Money' && (
                        <div className="space-y-3 animate-in fade-in duration-300">
                             <div>
                                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Opérateur</label>
                                <input type="text" value={momoOperator} onChange={e => setMomoOperator(e.target.value)} placeholder="MTN, Moov..." className="w-full p-3 border rounded-xl dark:bg-gray-700 font-bold uppercase"/>
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-400 mb-1">Numéro utilisé</label>
                                <input type="tel" value={momoNumber} onChange={e => setMomoNumber(e.target.value)} placeholder="00000000" className="w-full p-3 border rounded-xl dark:bg-gray-700 font-bold"/>
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-black uppercase text-gray-400 mb-1">Notes / Motif (Optionnel)</label>
                        <textarea
                            value={paymentNotes}
                            onChange={(e) => setPaymentNotes(e.target.value)}
                            className="w-full p-3 border rounded-xl dark:bg-gray-700 font-medium"
                            rows={2}
                            placeholder="Observations, numéro de chèque, etc."
                        />
                    </div>
                    <div className="pt-4 flex justify-end">
                        <button type="submit" disabled={isSubmitting || unpaidPurchases.length === 0} className="px-8 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-xs shadow-lg active:scale-95 disabled:opacity-50">
                            {isSubmitting ? 'Paiement...' : 'Confirmer le paiement'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Supprimer le paiement">
                <div className="p-6 space-y-6">
                    <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-start gap-3">
                        <WarningIcon className="w-6 h-6 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Attention : Cette action est irréversible.</p>
                            <p className="text-sm mt-1">Le paiement sera supprimé et le solde du fournisseur sera ajusté. Une trace de cette suppression sera conservée.</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase text-gray-500 mb-2">Motif de la suppression (Obligatoire)</label>
                        <textarea 
                            value={deleteReason}
                            onChange={(e) => setDeleteReason(e.target.value)}
                            className="w-full p-4 border rounded-xl dark:bg-gray-700 font-medium focus:ring-2 focus:ring-red-500"
                            rows={3}
                            placeholder="Erreur de saisie, chèque annulé..."
                            autoFocus
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                        <button 
                            onClick={() => setDeleteModalOpen(false)}
                            className="px-6 py-3 font-bold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-xl transition-colors"
                        >
                            Annuler
                        </button>
                        <button 
                            onClick={confirmDeletePayment}
                            disabled={!deleteReason.trim() || isDeleting}
                            className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isDeleting ? 'Suppression...' : (
                                <>
                                    <DeleteIcon className="w-5 h-5" />
                                    Confirmer la suppression
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SupplierAccountPage;