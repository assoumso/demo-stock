import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Customer, Sale, SalePayment, PaymentMethod, PaymentStatus, AppSettings, DeletedSalePayment } from '../types';
import { ArrowLeftIcon, PrintIcon, TrendingUpIcon, WarningIcon, PaymentIcon, DeleteIcon } from '../constants';
import { useReactToPrint } from 'react-to-print';
import Modal from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { PaymentReceipt } from '../components/PaymentReceipt';
import { formatCurrency } from '../utils/formatters';

interface AccountMovement {
    date: string;
    ref: string;
    description: string;
    debit: number;  
    credit: number; 
    balance: number;
    type: 'sale' | 'payment' | 'opening';
    paymentId?: string; // ID du document de paiement (pour suppression)
    saleId?: string;    // ID de la vente associée (pour mise à jour solde)
}

    const CustomerAccountPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const printRef = useRef<HTMLDivElement>(null);
    const receiptRef = useRef<HTMLDivElement>(null);

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [movements, setMovements] = useState<AccountMovement[]>([]);
    const [summary, setSummary] = useState({ totalDue: 0, totalPaid: 0, balance: 0 });
    const [unpaidSales, setUnpaidSales] = useState<Sale[]>([]);
    const [openingBalanceRemaining, setOpeningBalanceRemaining] = useState(0);

    // Calcul des totaux pour le tableau
    const totalDebit = React.useMemo(() => movements.reduce((sum, m) => sum + m.debit, 0), [movements]);
    const totalCredit = React.useMemo(() => movements.reduce((sum, m) => sum + m.credit, 0), [movements]);

    // Modal Payment
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Espèces');
    const [momoOperator, setMomoOperator] = useState('');
    const [momoNumber, setMomoNumber] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [selectedSaleId, setSelectedSaleId] = useState<string>('');
    const [useCreditBalance, setUseCreditBalance] = useState(false);
    const [selectAllInvoices, setSelectAllInvoices] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Receipt Modal
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [lastPayment, setLastPayment] = useState<SalePayment | null>(null);
    const [lastPaymentBalance, setLastPaymentBalance] = useState(0);

    // Delete Modal
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [paymentToDelete, setPaymentToDelete] = useState<{id: string, saleId: string, amount: number} | null>(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Reprint State
    const [paymentToReprint, setPaymentToReprint] = useState<SalePayment | null>(null);
    const reprintRef = useRef<HTMLDivElement>(null);
    const handleReprint = useReactToPrint({ contentRef: reprintRef, onAfterPrint: () => setPaymentToReprint(null) });

    useEffect(() => {
        if (paymentToReprint) {
            handleReprint();
        }
    }, [paymentToReprint]);

    const fetchSettings = async () => {
        try {
            const { data: settingsData } = await supabase.from('app_settings').select('*');
            if (settingsData && settingsData.length > 0) {
                setSettings(settingsData[0] as AppSettings);
            }
        } catch (error) {
            console.error("Erreur chargement paramètres:", error);
        }
    };

    const fetchAccountData = async (background = false) => {
        if (!id) return;
        if (!background) setLoading(true);
        try {
            const { data: custData, error: custError } = await supabase
                .from('customers')
                .select('*')
                .eq('id', id)
                .single();
            if (custError || !custData) { navigate('/customers'); return; }
            setCustomer(custData as Customer);

            const { data: salesDocs, error: salesError } = await supabase
                .from('sales')
                .select('*')
                .eq('customerId', id);
            
            if (salesError) throw salesError;
            
            const saleIds = (salesDocs || []).map(s => s.id);
            const openingBalanceId = `OPENING_BALANCE_${id}`;
            const creditBalanceId = `CREDIT_BALANCE_${id}`;

            const { data: allPayments, error: paymentsError } = await supabase
                .from('sale_payments')
                .select('*')
                .or(`saleId.in.(${saleIds.join(',')}),saleId.eq.${openingBalanceId},saleId.eq.${creditBalanceId}`);

            if (paymentsError) throw paymentsError;

            const combined: AccountMovement[] = [];
            
            let currentOpeningBalanceRemaining = 0;
            if (custData.openingBalance && custData.openingBalance > 0) {
                const openingPayments = (allPayments || []).filter(p => p.saleId === openingBalanceId);
                const totalOpeningPaid = openingPayments.reduce((sum, p) => sum + p.amount, 0);
                currentOpeningBalanceRemaining = custData.openingBalance - totalOpeningPaid;
                
                combined.push({
                    date: custData.openingBalanceDate || new Date(0).toISOString(),
                    ref: 'OUV-INI',
                    description: `SOLDE D'OUVERTURE (RELIQUAT ANCIEN)`,
                    debit: custData.openingBalance,
                    credit: 0,
                    balance: 0,
                    type: 'opening'
                });

                openingPayments.forEach(p => {
                    combined.push({
                        date: p.date,
                        ref: `REG-OUV`,
                        description: `Règlement Solde d'Ouverture`,
                        debit: 0,
                        credit: p.amount,
                        balance: 0,
                        type: 'payment',
                        paymentId: p.id,
                        saleId: openingBalanceId
                    });
                });
            }
            setOpeningBalanceRemaining(currentOpeningBalanceRemaining);

            (salesDocs || []).forEach(s => {
                combined.push({
                    date: s.date,
                    ref: s.referenceNumber,
                    description: `Facture de vente n° ${s.referenceNumber}`,
                    debit: s.grandTotal,
                    credit: 0,
                    balance: 0,
                    type: 'sale',
                    saleId: s.id
                });

                const paymentsForThisSale = (allPayments || []).filter(p => p.saleId === s.id);
                const sumPaymentsDocs = paymentsForThisSale.reduce((acc, p) => acc + p.amount, 0);
                
                if (s.paidAmount > sumPaymentsDocs + 1) { 
                    combined.push({
                        date: s.date,
                        ref: s.referenceNumber,
                        description: `Paiement enregistré sur facture (Acompte)`,
                        debit: 0,
                        credit: s.paidAmount - sumPaymentsDocs,
                        balance: 0,
                        type: 'payment'
                    });
                }
            });

            (allPayments || []).forEach(p => {
                // On ignore les paiements du solde d'ouverture car ils sont déjà traités plus haut
                if (p.saleId?.startsWith('OPENING_BALANCE_')) return;

                if (p.saleId?.startsWith('CREDIT_BALANCE_')) {
                    combined.push({
                        date: p.date,
                        ref: `AVOIR-${p.id.slice(-4).toUpperCase()}`,
                        description: p.notes || `Dépôt / Avoir (Crédit généré)`,
                        debit: 0,
                        credit: p.amount,
                        balance: 0,
                        type: 'payment',
                        paymentId: p.id,
                        saleId: p.saleId
                    });
                    return;
                }

                // Exclure l'utilisation du crédit (Compte Avoir) du solde global pour éviter le double comptage
                if (p.method === 'Compte Avoir') return;

                const parentSale = (salesDocs || []).find(s => s.id === p.saleId);
                combined.push({
                    date: p.date,
                    ref: `REG-${p.id.slice(-4).toUpperCase()}`,
                    description: `Règlement facture ${parentSale?.referenceNumber || ''}`,
                    debit: 0,
                    credit: p.amount,
                    balance: 0,
                    type: 'payment',
                    paymentId: p.id,
                    saleId: p.saleId
                });
            });

            combined.sort((a, b) => {
                const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
                if (dateDiff !== 0) return dateDiff;
                // En cas de même date, les ventes (débit) passent avant les règlements (crédit)
                // pour que le solde de la ligne vente soit correct avant son règlement.
                if (a.debit !== b.debit) return b.debit - a.debit;
                return 0;
            });

            let runningBalance = 0;
            let tDue = 0;
            let tPaid = 0;
            const processed = combined.map(m => {
                const debit = Number(m.debit) || 0;
                const credit = Number(m.credit) || 0;
                runningBalance += (debit - credit);
                tDue += debit;
                tPaid += credit;
                return { ...m, balance: runningBalance, debit, credit };
            });

            setMovements(processed);
            setSummary({ totalDue: tDue, totalPaid: tPaid, balance: runningBalance });
            
            const unpaid = (salesDocs || []).filter(s => s.paymentStatus !== 'Payé');
            setUnpaidSales(unpaid.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
            
            if (currentOpeningBalanceRemaining > 0) {
                setSelectedSaleId(openingBalanceId);
            } else if(unpaid.length > 0) {
                setSelectedSaleId(unpaid[0].id);
            }

        } catch (err) {
            console.error("Erreur relevé:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { 
        fetchSettings();
        fetchAccountData(); 
    }, [id, navigate]);

    const initiateDeletePayment = (paymentId: string, saleId: string, amount: number) => {
        setPaymentToDelete({ id: paymentId, saleId, amount });
        setDeleteReason('');
        setDeleteModalOpen(true);
    };

    const confirmDeletePayment = async () => {
        if (!paymentToDelete || !user || !id) return;
        if (!deleteReason.trim()) {
            alert("Veuillez saisir un motif de suppression.");
            return;
        }

        setIsDeleting(true);
        try {
            const { id: paymentId, saleId, amount } = paymentToDelete;
            
            // Get payment data
            const { data: paymentData, error: pError } = await supabase
                .from('sale_payments')
                .select('*')
                .eq('id', paymentId)
                .single();
            if (pError || !paymentData) throw new Error("Paiement introuvable");

            // Handle Credit Balance Impacts
            const { data: customerData, error: cError } = await supabase
                .from('customers')
                .select('*')
                .eq('id', id)
                .single();
            
            if (!cError && customerData) {
                let currentCredit = customerData.creditBalance || 0;
                let creditChanged = false;

                if (paymentData.method === 'Compte Avoir') {
                    currentCredit += amount;
                    creditChanged = true;
                }

                if (saleId?.startsWith('CREDIT_BALANCE_')) {
                    if (currentCredit < amount) {
                        throw new Error(`Impossible de supprimer cet avoir : une partie a déjà été utilisée (Solde: ${formatCurrency(currentCredit)}).`);
                    }
                    currentCredit -= amount;
                    creditChanged = true;
                }

                if (creditChanged) {
                    await supabase
                        .from('customers')
                        .update({ creditBalance: currentCredit })
                        .eq('id', id);
                }
            }

            // Update Sale if necessary
            if (saleId && !saleId.startsWith('OPENING_BALANCE_') && !saleId.startsWith('CREDIT_BALANCE_')) {
                const { data: saleData, error: sError } = await supabase
                    .from('sales')
                    .select('*')
                    .eq('id', saleId)
                    .single();
                
                if (!sError && saleData) {
                    const newPaid = Math.max(0, (saleData.paidAmount || 0) - amount);
                    let newStatus: PaymentStatus = 'En attente';
                    if (newPaid >= saleData.grandTotal - 0.1) newStatus = 'Payé';
                    else if (newPaid > 0.1) newStatus = 'Partiel';

                    await supabase
                        .from('sales')
                        .update({ paidAmount: newPaid, paymentStatus: newStatus })
                        .eq('id', saleId);
                }
            }

            // Store deleted payment info
            const deletedPaymentData: DeletedSalePayment = {
                originalPayment: paymentData as SalePayment,
                deletedAt: new Date().toISOString(),
                deletedBy: user.uid,
                deleteReason: deleteReason
            };
            await supabase.from('deleted_sale_payments').insert(deletedPaymentData);

            // Delete original payment
            await supabase.from('sale_payments').delete().eq('id', paymentId);

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
        if (!user || paymentAmount <= 0 || !id) return;

        if (paymentMethod === 'Mobile Money' && (!momoOperator || !momoNumber)) {
            setError("Opérateur et numéro requis pour Mobile Money.");
            return;
        }

        setIsSubmitting(true);
        setError(null);
        
        try {
            const allDebts: { id: string, type: 'sale' | 'opening', remaining: number, date: string, refNumber?: string }[] = [];

            if (openingBalanceRemaining > 0.1) {
                allDebts.push({
                    id: `OPENING_BALANCE_${id}`,
                    type: 'opening',
                    remaining: openingBalanceRemaining,
                    date: '1970-01-01',
                    refNumber: 'SOLDE OUVERTURE'
                });
            }

            unpaidSales.forEach(s => {
                const rem = s.grandTotal - s.paidAmount;
                if (rem > 0.1) {
                    allDebts.push({
                        id: s.id,
                        type: 'sale',
                        remaining: rem,
                        date: s.date,
                        refNumber: s.referenceNumber
                    });
                }
            });

            allDebts.sort((a, b) => {
                if (a.id === selectedSaleId) return -1;
                if (b.id === selectedSaleId) return 1;
                return new Date(a.date).getTime() - new Date(b.date).getTime();
            });

            const totalDebt = allDebts.reduce((sum, d) => sum + d.remaining, 0);
            if (paymentAmount > totalDebt + 10) {
                if (!window.confirm(`Le montant saisi (${formatCurrency(paymentAmount)}) est supérieur à la dette totale du client (${formatCurrency(totalDebt)}). Voulez-vous continuer et créer un avoir pour le surplus ?`)) {
                    setIsSubmitting(false);
                    return;
                }
            }

            // Process Payment
            const { data: customerData, error: custError } = await supabase
                .from('customers')
                .select('*')
                .eq('id', id)
                .single();
            if (custError || !customerData) throw new Error("Client introuvable");
            
            let currentCreditBalance = customerData.creditBalance || 0;
            let creditPart = 0;
            let cashPart = paymentAmount;

            if (paymentMethod === 'Compte Avoir') {
                if (paymentAmount > currentCreditBalance) throw new Error(`Solde Avoir insuffisant (Disponible: ${formatCurrency(currentCreditBalance)})`);
                creditPart = paymentAmount;
                cashPart = 0;
                currentCreditBalance -= creditPart;
            } else if (useCreditBalance && currentCreditBalance > 0) {
                creditPart = Math.min(paymentAmount, currentCreditBalance);
                cashPart = paymentAmount - creditPart;
                currentCreditBalance -= creditPart;
            }

            let remainingCredit = creditPart;
            let remainingCash = cashPart;

            for (const debt of allDebts) {
                if (remainingCredit <= 0.01 && remainingCash <= 0.01) break;

                let currentDue = debt.remaining;
                let saleData: any = null;

                if (debt.type === 'sale') {
                    const { data } = await supabase.from('sales').select('*').eq('id', debt.id).single();
                    saleData = data;
                    if (!saleData) continue;
                    currentDue = saleData.grandTotal - saleData.paidAmount;
                }

                if (remainingCredit > 0.01 && currentDue > 0.01) {
                    const payAmount = Math.min(remainingCredit, currentDue);
                    await supabase.from('sale_payments').insert({
                        saleId: debt.id,
                        date: new Date().toISOString(),
                        amount: payAmount,
                        method: 'Compte Avoir',
                        createdByUserId: user.uid,
                        notes: (paymentNotes ? paymentNotes + ' ' : '') + `(Via Avoir)` + (allDebts.length > 1 && debt.id !== selectedSaleId ? ` (Reliquat)` : '')
                    });
                    currentDue -= payAmount;
                    remainingCredit -= payAmount;
                    if (saleData) saleData.paidAmount += payAmount;
                }

                if (remainingCash > 0.01 && currentDue > 0.01) {
                    const payAmount = Math.min(remainingCash, currentDue);
                    const pData: any = {
                        saleId: debt.id,
                        date: new Date().toISOString(),
                        amount: payAmount,
                        method: paymentMethod,
                        createdByUserId: user.uid,
                        notes: paymentNotes + (allDebts.length > 1 && debt.id !== selectedSaleId ? ` (Reliquat)` : '')
                    };
                    if (paymentMethod === 'Mobile Money') {
                        pData.momoOperator = momoOperator;
                        pData.momoNumber = momoNumber;
                    }
                    await supabase.from('sale_payments').insert(pData);
                    currentDue -= payAmount;
                    remainingCash -= payAmount;
                    if (saleData) saleData.paidAmount += payAmount;
                }

                if (debt.type === 'sale' && saleData) {
                    const newStatus = (saleData.grandTotal - saleData.paidAmount) <= 0.1 ? 'Payé' : 'Partiel';
                    await supabase.from('sales').update({ paidAmount: saleData.paidAmount, paymentStatus: newStatus }).eq('id', debt.id);
                }
            }

            if (remainingCash > 0.1) {
                const creditPayment: any = {
                    saleId: `CREDIT_BALANCE_${id}`,
                    date: new Date().toISOString(),
                    amount: remainingCash,
                    method: paymentMethod,
                    createdByUserId: user.uid,
                    notes: (paymentNotes || 'Avoir généré suite surplus') + ` (Surplus)`
                };
                if (paymentMethod === 'Mobile Money') {
                    creditPayment.momoOperator = momoOperator;
                    creditPayment.momoNumber = momoNumber;
                }
                await supabase.from('sale_payments').insert(creditPayment);
                currentCreditBalance += remainingCash;
            }

            if (currentCreditBalance !== (customerData.creditBalance || 0)) {
                await supabase.from('customers').update({ creditBalance: currentCreditBalance }).eq('id', id);
            }

            const receiptAmount = paymentAmount;
            const receiptMethod = paymentMethod;
            const receiptNotes = paymentNotes;
            const receiptSaleId = selectedSaleId;
            const previousBalance = summary.balance;

            setIsPaymentModalOpen(false);
            setPaymentAmount(0);
            setPaymentNotes('');
            setMomoOperator('');
            setMomoNumber('');
            setPaymentMethod('Espèces');
            setUseCreditBalance(false);
            
            await fetchAccountData(true);
            
            const tempReceiptId = `REC-${Date.now().toString().slice(-6)}`;
            setLastPayment({
                id: tempReceiptId,
                saleId: receiptSaleId || 'MULTI_PAYMENT',
                date: new Date().toISOString(),
                amount: receiptAmount,
                method: receiptMethod,
                createdByUserId: user.uid,
                notes: receiptNotes
            } as SalePayment);
            
            setLastPaymentBalance(previousBalance > receiptAmount ? previousBalance - receiptAmount : 0); 
            setShowReceiptModal(true);
        } catch (err: any) {
            console.error("Erreur lors du paiement:", err);
            setError(err.message || "Une erreur est survenue lors du paiement");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrint = useReactToPrint({ contentRef: printRef });
    const handlePrintReceipt = useReactToPrint({ contentRef: receiptRef });



    if (loading) return <div className="p-12 text-center text-gray-500 font-bold animate-pulse uppercase tracking-widest">Génération du Grand Livre...</div>;

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-12">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                <div className="flex items-center">
                    <button onClick={() => navigate('/customers')} className="p-3 mr-4 bg-white dark:bg-gray-800 rounded-full shadow-lg border dark:border-gray-700 hover:scale-110 transition-all">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Fiche Compte Client</h1>
                        <p className="text-sm text-primary-600 font-black uppercase tracking-widest">{customer?.name}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => navigate('/credit-notes/new', { state: { preselectedCustomerId: id } })}
                        className="flex items-center px-6 py-3 bg-purple-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-purple-700 transition-all"
                    >
                        <TrendingUpIcon className="w-5 h-5 mr-2" /> Nouvel Avoir
                    </button>
                    <button 
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="flex items-center px-6 py-3 bg-green-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-green-700 transition-all"
                    >
                        <PaymentIcon className="w-5 h-5 mr-2" /> Enregistrer un règlement
                    </button>
                    <button onClick={handlePrint} className="flex items-center px-6 py-3 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-black transition-all">
                        <PrintIcon className="w-5 h-5 mr-2" /> Imprimer Relevé
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 no-print">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border-t-4 border-blue-500">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total Dû (Ventes + Ouverture)</p>
                    <p className="text-2xl font-black">{formatCurrency(summary.totalDue)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border-t-4 border-green-500">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total Règlement (Crédit)</p>
                    <p className="text-2xl font-black text-green-600">{formatCurrency(summary.totalPaid)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border-t-4 border-yellow-500">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Crédit Disponible (Avoir)</p>
                    <p className="text-2xl font-black text-yellow-600">{formatCurrency(customer?.creditBalance || 0)}</p>
                </div>
                <div className={`bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border-t-4 ${summary.balance > 0 ? 'border-red-500' : 'border-primary-500'}`}>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Solde Net Client</p>
                    <p className={`text-2xl font-black ${summary.balance > 0 ? 'text-red-600' : 'text-primary-600'}`}>{formatCurrency(summary.balance)}</p>
                </div>
            </div>

            <div ref={printRef} className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border dark:border-gray-700 p-4 sm:p-10">
                <div className="hidden print:block mb-10 border-b-2 border-gray-900 pb-6 text-black">
                    <div className="mb-8 text-center">
                        <img src={settings?.companyLogoUrl || '/logo.svg'} alt="Logo" className="mx-auto h-20 w-auto mb-4 object-contain"/>
                        <h1 className="text-2xl font-black uppercase">{settings?.companyName}</h1>
                        <p className="text-sm">{settings?.companyAddress || "Korhogo, Abidjan , lagune, BP 287, Côte d'ivoire"}</p>
                        <p className="text-sm">{settings?.companyPhone || "07-08-34-13-22"}</p>
                    </div>
                    <h2 className="text-3xl font-black uppercase">{customer?.businessName || customer?.name}</h2>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Relevé de compte au {new Date().toLocaleDateString('fr-FR')}</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th className="px-4 py-4 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">Date</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">Référence</th>
                                <th className="px-4 py-4 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">Désignation Opération</th>
                                <th className="px-4 py-4 text-right text-[10px] font-black uppercase text-gray-500 tracking-widest">Débit (+)</th>
                                <th className="px-4 py-4 text-right text-[10px] font-black uppercase text-green-600 tracking-widest">Crédit (-)</th>
                                <th className="px-4 py-4 text-right text-[10px] font-black uppercase text-gray-500 tracking-widest bg-gray-100 dark:bg-gray-700">Solde Progressif</th>
                                <th className="px-4 py-4 text-right text-[10px] font-black uppercase text-gray-500 tracking-widest no-print">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {movements.map((m, idx) => (
                                <tr key={idx} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${m.type === 'opening' ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                                    <td className="px-4 py-4 text-xs font-bold whitespace-nowrap">{new Date(m.date).toLocaleDateString('fr-FR')}</td>
                                    <td className="px-4 py-4 text-xs font-black text-primary-600 uppercase tracking-tighter">{m.ref}</td>
                                    <td className="px-4 py-4 text-xs font-medium uppercase tracking-tight text-gray-600 dark:text-gray-300">{m.description}</td>
                                    <td className="px-4 py-4 text-xs text-right font-bold">{m.debit > 0 ? formatCurrency(m.debit) : '-'}</td>
                                    <td className="px-4 py-4 text-xs text-right font-bold text-green-600">{m.credit > 0 ? formatCurrency(m.credit) : '-'}</td>
                                    <td className={`px-4 py-4 text-xs text-right font-black bg-gray-50/50 dark:bg-gray-900/20 ${m.balance > 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatCurrency(m.balance)}</td>
                                    <td className="px-4 py-4 text-right no-print">
                                        {m.type === 'payment' && (
                                            <div className="flex justify-end gap-1">
                                                {m.paymentId && (
                                                    <button 
                                                        onClick={() => {
                                                            const doReprint = async () => {
                                                                try {
                                                                    const { data: pData, error: pError } = await supabase
                                                                        .from('sale_payments')
                                                                        .select('*')
                                                                        .eq('id', m.paymentId!)
                                                                        .single();
                                                                    
                                                                    if (!pError && pData) {
                                                                        setPaymentToReprint(pData as SalePayment);
                                                                    } else {
                                                                        alert("Impossible de retrouver les détails complets du paiement.");
                                                                    }
                                                                } catch (e) {
                                                                    console.error("Error fetching payment for reprint", e);
                                                                    alert("Erreur lors de la récupération du paiement.");
                                                                }
                                                            };
                                                            doReprint();
                                                        }}
                                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all active:scale-95"
                                                        title="Réimprimer le reçu"
                                                    >
                                                        <PrintIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                                {m.paymentId && m.saleId && (
                                                    <button 
                                                        onClick={() => initiateDeletePayment(m.paymentId!, m.saleId!, m.credit)}
                                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-95"
                                                        title="Supprimer ce paiement"
                                                    >
                                                        <DeleteIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t-2 border-gray-300 dark:border-gray-600">
                            <tr className="bg-blue-50 dark:bg-blue-900/20">
                                <td colSpan={3} className="px-4 py-4 text-right text-xs font-black uppercase text-gray-600 dark:text-gray-400 tracking-widest">Totaux</td>
                                <td className="px-4 py-4 text-right text-xs font-black text-gray-900 dark:text-white">{formatCurrency(totalDebit)}</td>
                                <td className="px-4 py-4 text-right text-xs font-black text-green-600">{formatCurrency(totalCredit)}</td>
                                <td className="px-4 py-4 text-right text-xs font-black text-primary-600">{formatCurrency(summary.balance)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Payment Modal */}
            <Modal isOpen={isPaymentModalOpen} onClose={() => { setIsPaymentModalOpen(false); setSelectAllInvoices(false); setPaymentAmount(0); }} title="NOUVEAU RÈGLEMENT">
                <form onSubmit={handleQuickPayment} className="space-y-5">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-[10px] font-black uppercase text-gray-500">Factures à régler</label>
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-black text-primary-600 hover:text-primary-700 transition-colors select-none">
                                <input
                                    type="checkbox"
                                    checked={selectAllInvoices}
                                    onChange={(e) => {
                                        setSelectAllInvoices(e.target.checked);
                                        if (e.target.checked) {
                                            setSelectedSaleId('');
                                            const total = (openingBalanceRemaining > 0 ? openingBalanceRemaining : 0)
                                                + unpaidSales.reduce((sum, s) => sum + (s.grandTotal - s.paidAmount), 0);
                                            setPaymentAmount(Math.round(total));
                                        } else {
                                            setPaymentAmount(0);
                                        }
                                    }}
                                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 border-gray-300 cursor-pointer"
                                />
                                <span>✅ Tout sélectionner ({formatCurrency(
                                    (openingBalanceRemaining > 0 ? openingBalanceRemaining : 0)
                                    + unpaidSales.reduce((sum, s) => sum + (s.grandTotal - s.paidAmount), 0)
                                )})</span>
                            </label>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {openingBalanceRemaining > 0 && (
                                <label className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all select-none ${
                                    selectAllInvoices || selectedSaleId === `OPENING_BALANCE_${id}`
                                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={selectAllInvoices || selectedSaleId === `OPENING_BALANCE_${id}`}
                                            onChange={(e) => {
                                                if (selectAllInvoices) return;
                                                setSelectedSaleId(e.target.checked ? `OPENING_BALANCE_${id}` : '');
                                                if (e.target.checked) setPaymentAmount(Math.round(openingBalanceRemaining));
                                            }}
                                            className="w-4 h-4 text-orange-500 rounded focus:ring-orange-400 border-gray-300 cursor-pointer"
                                        />
                                        <div>
                                            <p className="text-xs font-black uppercase text-orange-700 dark:text-orange-400">Solde d'ouverture</p>
                                            <p className="text-[10px] text-gray-400">Antérieur</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-black text-orange-600">{formatCurrency(openingBalanceRemaining)}</span>
                                </label>
                            )}
                            {unpaidSales.map(s => {
                                const remaining = s.grandTotal - s.paidAmount;
                                const isChecked = selectAllInvoices || selectedSaleId === s.id;
                                return (
                                    <label key={s.id} className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all select-none ${
                                        isChecked
                                            ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
                                    }`}>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={(e) => {
                                                    if (selectAllInvoices) return;
                                                    setSelectedSaleId(e.target.checked ? s.id : '');
                                                    if (e.target.checked) setPaymentAmount(Math.round(remaining));
                                                }}
                                                className="w-4 h-4 text-green-600 rounded focus:ring-green-500 border-gray-300 cursor-pointer"
                                            />
                                            <div>
                                                <p className="text-xs font-black uppercase">{s.referenceNumber}</p>
                                                <p className="text-[10px] text-gray-400">{new Date(s.date).toLocaleDateString('fr-FR')}</p>
                                            </div>
                                        </div>
                                        <span className="text-sm font-black text-red-600">{formatCurrency(remaining)}</span>
                                    </label>
                                );
                            })}
                            {openingBalanceRemaining <= 0 && unpaidSales.length === 0 && (
                                <p className="text-center text-sm text-gray-400 py-4">Aucune facture impayée.</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Montant</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    value={paymentAmount} 
                                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value))}
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-black text-lg text-green-600 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    min="0"
                                    required
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">FCFA</span>
                            </div>
                            
                            {(customer?.creditBalance || 0) > 0 && paymentMethod !== 'Compte Avoir' && (
                                <div className="mt-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={useCreditBalance}
                                            onChange={(e) => setUseCreditBalance(e.target.checked)}
                                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500 border-gray-300"
                                        />
                                        <span>Utiliser l'avoir disponible ({formatCurrency(customer?.creditBalance || 0)})</span>
                                    </label>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Mode</label>
                            <select 
                                value={paymentMethod} 
                                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            >
                                <option value="Espèces">Espèces</option>
                                <option value="Mobile Money">Mobile Money</option>
                                <option value="Virement bancaire">Virement</option>
                                <option value="Autre">Autre</option>
                                {(customer?.creditBalance || 0) > 0 && (
                                    <option value="Compte Avoir">Compte Avoir (Dispo: {formatCurrency(customer?.creditBalance || 0)})</option>
                                )}
                            </select>
                        </div>
                    </div>

                    {paymentMethod === 'Mobile Money' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-blue-600 mb-1.5">Opérateur</label>
                                <select 
                                    value={momoOperator} 
                                    onChange={(e) => setMomoOperator(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-blue-200 rounded-lg text-sm font-medium"
                                >
                                    <option value="">Choisir...</option>
                                    <option value="OM">Orange Money</option>
                                    <option value="MOMO">MTN MoMo</option>
                                    <option value="MOOV">Moov Money</option>
                                    <option value="WAVE">Wave</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-blue-600 mb-1.5">Numéro</label>
                                <input 
                                    type="text" 
                                    value={momoNumber} 
                                    onChange={(e) => setMomoNumber(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-blue-200 rounded-lg text-sm font-bold tracking-wider"
                                    placeholder="0700000000"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Notes / Motif (Optionnel)</label>
                        <textarea
                            value={paymentNotes}
                            onChange={(e) => setPaymentNotes(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-medium text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            rows={2}
                            placeholder="Observations, numéro de reçu manuel, etc."
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-100">
                            <WarningIcon className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button 
                            type="button"
                            onClick={() => setIsPaymentModalOpen(false)}
                            className="px-5 py-2.5 font-bold text-xs uppercase tracking-wider text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            Annuler
                        </button>
                        <button 
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2.5 bg-green-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-green-700 disabled:opacity-50 shadow-lg shadow-green-200 transition-all active:scale-95"
                        >
                            {isSubmitting ? 'Validation...' : 'Valider'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Receipt Modal */}
            <Modal isOpen={showReceiptModal} onClose={() => setShowReceiptModal(false)} title="REÇU DE PAIEMENT" maxWidth="max-w-xl">
                <div className="flex flex-col items-center">
                    <div className="w-full overflow-x-auto flex justify-center py-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-xl mb-6">
                        {lastPayment && customer && (
                            <div className="shadow-xl ring-1 ring-gray-900/5 bg-white transform transition-all hover:scale-[1.02] duration-300">
                                <PaymentReceipt 
                                    ref={receiptRef}
                                    payment={lastPayment}
                                    customer={customer}
                                    settings={settings}
                                    balanceAfter={lastPaymentBalance}
                                    reference={movements.find(m => m.saleId === lastPayment.saleId)?.ref || lastPayment.saleId}
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-3 w-full justify-center">
                         <button 
                            onClick={() => setShowReceiptModal(false)}
                            className="px-5 py-2.5 font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-xs uppercase tracking-wider flex-1 md:flex-none justify-center flex"
                        >
                            Fermer
                        </button>
                        <button 
                            onClick={handlePrintReceipt}
                            className="px-6 py-2.5 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center justify-center transition-all active:scale-95 flex-1 md:flex-none"
                        >
                            <PrintIcon className="w-4 h-4 mr-2" /> Imprimer
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="CONFIRMATION DE SUPPRESSION">
                <div className="space-y-5">
                    <div className="bg-red-50 p-4 rounded-xl flex items-start gap-3 border border-red-100">
                        <div className="p-2 bg-red-100 rounded-full flex-shrink-0">
                            <WarningIcon className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-red-700 text-sm uppercase tracking-wide">Action irréversible</h3>
                            <p className="text-xs text-red-600 mt-1 leading-relaxed">
                                Vous êtes sur le point de supprimer un paiement de <span className="font-black bg-red-100 px-1 rounded">{formatCurrency(paymentToDelete?.amount || 0)}</span>.
                                Cette action annulera l'encaissement et mettra à jour le solde du client.
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-500 mb-1.5">Motif de la suppression <span className="text-red-500">*</span></label>
                        <textarea
                            value={deleteReason}
                            onChange={(e) => setDeleteReason(e.target.value)}
                            className="w-full p-3 bg-white border border-gray-200 rounded-xl font-medium text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                            rows={3}
                            placeholder="Erreur de saisie, chèque sans provision, doublon..."
                            required
                        />
                        <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-wide flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                            Le motif est obligatoire pour l'audit
                        </p>
                    </div>

                    <div className="flex flex-wrap justify-end gap-3 pt-2">
                        <button 
                            onClick={() => setDeleteModalOpen(false)}
                            className="px-5 py-2.5 font-bold text-xs uppercase tracking-wider text-gray-500 hover:bg-gray-100 rounded-xl transition-colors flex-1 md:flex-none justify-center flex"
                        >
                            Annuler
                        </button>
                        <button 
                            onClick={confirmDeletePayment}
                            disabled={isDeleting || !deleteReason.trim()}
                            className="px-6 py-2.5 bg-red-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-red-700 disabled:opacity-50 shadow-lg shadow-red-200 flex items-center justify-center transition-all active:scale-95 flex-1 md:flex-none"
                        >
                            {isDeleting ? 'Suppression...' : 'Confirmer'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Hidden Reprint Component */}
            <div className="hidden">
                {paymentToReprint && customer && (
                    <PaymentReceipt 
                        ref={reprintRef}
                        payment={paymentToReprint}
                        customer={customer}
                        settings={settings}
                        balanceAfter={movements.find(m => m.paymentId === paymentToReprint.id)?.balance || 0}
                        reference={movements.find(m => m.paymentId === paymentToReprint.id)?.ref || paymentToReprint.saleId}
                    />
                )}
            </div>
        </div>
    );
};

export default CustomerAccountPage;
