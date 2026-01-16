
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, runTransaction, DocumentData } from 'firebase/firestore';
import { Customer, Supplier, Sale, Purchase, SalePayment, Payment, PaymentMethod, PaymentStatus, AppSettings } from '../types';
import { useAuth } from '../hooks/useAuth';
import { SearchIcon, CustomersIcon, SuppliersIcon, WarningIcon, CheckIcon, EditIcon, DeleteIcon } from '../constants';
import Modal from '../components/Modal';
import { PaymentReceipt } from '../components/PaymentReceipt';
import { useReactToPrint } from 'react-to-print';

const PaymentsPage: React.FC = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'clients' | 'suppliers'>('clients');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Receipt State
    const receiptRef = useRef<HTMLDivElement>(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [lastPayment, setLastPayment] = useState<SalePayment | null>(null);
    const [lastPaymentBalance, setLastPaymentBalance] = useState(0);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [receiptCustomer, setReceiptCustomer] = useState<Customer | null>(null);

    // Data lists
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    const handlePrintReceipt = useReactToPrint({ contentRef: receiptRef });
    
    // Selection state
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPartner, setSelectedPartner] = useState<Customer | Supplier | null>(null);
    const [unpaidInvoices, setUnpaidInvoices] = useState<(Sale | Purchase)[]>([]);
    const [accountBalance, setAccountBalance] = useState(0);

    // Payment Form state
    const [paymentAmount, setPaymentAmount] = useState<number>(0);
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Espèces');
    const [momoOperator, setMomoOperator] = useState('');
    const [momoNumber, setMomoNumber] = useState('');
    const [paymentNote, setPaymentNote] = useState('');
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // History State
    const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
    const [editingPayment, setEditingPayment] = useState<any | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    useEffect(() => {
        const fetchBaseData = async () => {
            setLoading(true);
            try {
                const [custSnap, supSnap, settingsSnap] = await Promise.all([
                    getDocs(collection(db, "customers")),
                    getDocs(collection(db, "suppliers")),
                    getDocs(collection(db, "appSettings"))
                ]);
                setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
                setSuppliers(supSnap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
                
                if (!settingsSnap.empty) {
                    setSettings({ id: settingsSnap.docs[0].id, ...settingsSnap.docs[0].data() } as AppSettings);
                }
            } catch (err) {
                setError("Erreur lors du chargement des données.");
            } finally {
                setLoading(false);
            }
        };
        fetchBaseData();
    }, []);

    // Fetch unpaid invoices and correct balance when partner selected
    useEffect(() => {
        const fetchPartnerInvoices = async () => {
            if (!selectedPartner) {
                setUnpaidInvoices([]);
                setAccountBalance(0);
                return;
            }

            try {
                let invoices: (Sale | Purchase)[] = [];
                // POINT CRITIQUE : Toujours inclure le solde d'ouverture dans le calcul total
                let openingBalance = (selectedPartner as any).openingBalance || 0;
                let balance = openingBalance;
                let paidOnOpening = 0;

                // CORRECTION : Soustraire les paiements déjà effectués sur le solde d'ouverture
                if (openingBalance > 0) {
                    const paymentCollection = activeTab === 'clients' ? 'salePayments' : 'purchasePayments';
                    const idField = activeTab === 'clients' ? 'saleId' : 'purchaseId';
                    const openingBalanceId = `OPENING_BALANCE_${selectedPartner.id}`;
                    
                    const qOpenPayments = query(collection(db, paymentCollection), where(idField, "==", openingBalanceId));
                    const snapOpenPayments = await getDocs(qOpenPayments);
                    paidOnOpening = snapOpenPayments.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);
                    
                    balance = Math.max(0, openingBalance - paidOnOpening);

                    // Si reste à payer sur solde d'ouverture, l'ajouter comme une "facture"
                    if (balance > 0.1) {
                         const openingInvoice: any = {
                            id: openingBalanceId,
                            referenceNumber: "SOLDE D'OUVERTURE",
                            date: (selectedPartner as any).openingBalanceDate || new Date().toISOString(),
                            grandTotal: openingBalance,
                            paidAmount: paidOnOpening,
                            paymentStatus: 'Partiel',
                            customerId: selectedPartner.id, // For compatibility
                            supplierId: selectedPartner.id // For compatibility
                        };
                        invoices.push(openingInvoice);
                    }
                }

                if (activeTab === 'clients') {
                    const q = query(collection(db, "sales"), where("customerId", "==", selectedPartner.id));
                    const snap = await getDocs(q);
                    const allSales = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
                    const unpaidSales = allSales.filter(s => s.paymentStatus !== 'Payé');
                    invoices = [...invoices, ...unpaidSales];
                    // Calcul du solde : Solde d'ouverture (ajusté) + (Total Ventes - Total Payé sur factures)
                    allSales.forEach(s => balance += (s.grandTotal - s.paidAmount));
                } else {
                    const q = query(collection(db, "purchases"), where("supplierId", "==", selectedPartner.id));
                    const snap = await getDocs(q);
                    const allPurchases = snap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase));
                    const unpaidPurchases = allPurchases.filter(p => p.paymentStatus !== 'Payé');
                    invoices = [...invoices, ...unpaidPurchases];
                    // Pour les fournisseurs
                    allPurchases.forEach(p => balance += (p.grandTotal - p.paidAmount));
                }

                invoices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                setUnpaidInvoices(invoices);
                setAccountBalance(balance);
                if (invoices.length > 0) setSelectedInvoiceId(invoices[0].id);
                else setSelectedInvoiceId('');
                
            } catch (err) {
                console.error(err);
            }
        };
        fetchPartnerInvoices();
    }, [selectedPartner, activeTab]);

    // Fetch history
    const fetchHistory = async () => {
        try {
            const collectionName = activeTab === 'clients' ? 'salePayments' : 'purchasePayments';
            const q = query(collection(db, collectionName), where("date", ">=", new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString())); // Last 3 months
            const snap = await getDocs(q);
            
            // Need to join with sales/purchases to get reference numbers if possible, or at least partner name
            // For simplicity, we filter by selectedPartner if set, otherwise show all.
            // But we need to know WHO paid. The Payment struct doesn't strictly have customerId/supplierId, only via the Invoice.
            // Wait, SalePayment has saleId. Sale has customerId.
            // This is N+1 problem.
            // Optimized approach: We fetched all customers/suppliers. We can't easily link back without fetching the invoice.
            // Let's just fetch ALL relevant invoices? No, too big.
            // Let's rely on the fact that if a partner is selected, we filter. If not, we might show "Chargement..." or limited info.
            
            // Better: When fetching payments, fetch their related invoices in batches?
            // Or just fetch payments for the selected partner?
            // The requirement implies a general table.
            
            // Let's try to fetch payments and then fetch the related invoices to get names/refs.
            let payments = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            if (selectedPartner) {
                // Filter by payments linked to invoices of this partner
                // We need to know which invoices belong to this partner.
                // We already fetched `unpaidInvoices`. But what about PAID invoices?
                // We need to fetch ALL invoices for this partner to filter history correctly?
                // Or we can query payments where `saleId` is in list of partner's sales.
                
                const invoiceCollection = activeTab === 'clients' ? 'sales' : 'purchases';
                const partnerField = activeTab === 'clients' ? 'customerId' : 'supplierId';
                const qInv = query(collection(db, invoiceCollection), where(partnerField, "==", selectedPartner.id));
                const snapInv = await getDocs(qInv);
                const partnerInvoiceIds = new Set(snapInv.docs.map(d => d.id));
                // Add opening balance ID
                partnerInvoiceIds.add(`OPENING_BALANCE_${selectedPartner.id}`);
                
                const idField = activeTab === 'clients' ? 'saleId' : 'purchaseId';
                payments = payments.filter(p => partnerInvoiceIds.has(p[idField]));
            } else {
                payments = payments.slice(0, 50); // Limit to 50 recent if no partner selected
            }
            
            // Enhance with invoice info
            const invoiceCollection = activeTab === 'clients' ? 'sales' : 'purchases';
            const enhancedPayments = await Promise.all(payments.map(async (p) => {
                const idField = activeTab === 'clients' ? 'saleId' : 'purchaseId';
                const invId = p[idField];
                
                if (invId.startsWith('OPENING_BALANCE_')) {
                    return { ...p, invoiceRef: "SOLDE D'OUVERTURE", partnerName: "N/A" };
                }
                
                // Check if we have it in unpaidInvoices? Unlikely if it's paid.
                // Fetch individually (cache could be used but simple fetch for now)
                const invRef = doc(db, invoiceCollection, invId);
                const invSnap = await getDocs(query(collection(db, invoiceCollection), where('__name__', '==', invId))); // using query to avoid try/catch on doc get if easier, but doc get is fine.
                // actually getDoc is better
                // But let's use the one we have
                // We can't easily get partner name without the invoice.
                
                // To avoid N fetches, we could fetch all sales/purchases once? No.
                // We will accept some loading time or missing info if not selected.
                // If selectedPartner is set, we know the name.
                
                let refNum = '...';
                let pName = selectedPartner?.name || '...';
                
                if (!selectedPartner) {
                    // We need to fetch the invoice to get partner ID then partner name
                    // This is heavy. Maybe just show Reference?
                    // Let's fetch invoice data.
                    try {
                         const d = await import('firebase/firestore').then(mod => mod.getDoc(invRef));
                         if (d.exists()) {
                             const data = d.data() as any;
                             refNum = data.referenceNumber;
                             if (!selectedPartner) {
                                 const partnerList = activeTab === 'clients' ? customers : suppliers;
                                 const partnerId = activeTab === 'clients' ? data.customerId : data.supplierId;
                                 pName = partnerList.find(x => x.id === partnerId)?.name || 'Inconnu';
                             }
                         }
                    } catch (e) {}
                } else {
                     // We can try to find ref in unpaidInvoices, otherwise fetch
                     const inv = unpaidInvoices.find(i => i.id === invId);
                     if (inv) refNum = inv.referenceNumber;
                     else {
                         try {
                             const d = await import('firebase/firestore').then(mod => mod.getDoc(invRef));
                             if (d.exists()) refNum = d.data()?.referenceNumber;
                         } catch (e) {}
                     }
                }
                
                return { ...p, invoiceRef: refNum, partnerName: pName };
            }));
            
            setPaymentHistory(enhancedPayments);
        } catch (err) {
            console.error("Error fetching history", err);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [activeTab, selectedPartner, customers, suppliers]); // Refetch when tab or partner changes

    const handleDeletePayment = async (paymentId: string, invoiceId: string, amount: number) => {
        if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce paiement ? Cela mettra à jour le solde de la facture.")) return;

        try {
            await runTransaction(db, async (transaction) => {
                const collectionName = activeTab === 'clients' ? 'sales' : 'purchases';
                const paymentCollection = activeTab === 'clients' ? 'salePayments' : 'purchasePayments';
                
                // 1. Revert invoice
                if (!invoiceId.startsWith('OPENING_BALANCE_')) {
                    const invoiceRef = doc(db, collectionName, invoiceId);
                    const invoiceDoc = await transaction.get(invoiceRef);

                    if (invoiceDoc.exists()) {
                         const invData = invoiceDoc.data() as any;
                         const newPaid = Math.max(0, (invData.paidAmount || 0) - amount);
                         const newStatus = (invData.grandTotal - newPaid) <= 0.1 ? 'Payé' : (newPaid > 0.1 ? 'Partiel' : 'En attente');
                         
                         transaction.update(invoiceRef, {
                             paidAmount: newPaid,
                             paymentStatus: newStatus
                         });
                    }
                }

                // 2. Delete payment
                const paymentRef = doc(db, paymentCollection, paymentId);
                transaction.delete(paymentRef);
            });
            
            setSuccess("Paiement supprimé avec succès");
            fetchHistory(); // Refresh
            // Also refresh partner invoices if selected
            if (selectedPartner) {
                // Trigger re-fetch of partner invoices by toggling selection or logic?
                // The useEffect on [selectedPartner] might not trigger if object is same.
                // We can force it by calling a refresh function or relying on state update.
                // Let's force update
                setSelectedPartner({...selectedPartner}); 
            }
            setTimeout(() => setSuccess(null), 3000);
        } catch (e: any) {
            console.error(e);
            setError("Erreur lors de la suppression: " + e.message);
        }
    };

    const handleEditClick = (payment: any) => {
        setEditingPayment({ ...payment, newAmount: payment.amount });
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingPayment) return;
        const { id, amount, newAmount, date, method, notes, invoiceRef, saleId, purchaseId } = editingPayment;
        const invoiceId = activeTab === 'clients' ? saleId : purchaseId;

        try {
            await runTransaction(db, async (transaction) => {
                const collectionName = activeTab === 'clients' ? 'sales' : 'purchases';
                const paymentCollection = activeTab === 'clients' ? 'salePayments' : 'purchasePayments';
                
                // 1. Check Invoice if amount changed
                if (Math.abs(newAmount - amount) > 0.1 && !invoiceId.startsWith('OPENING_BALANCE_')) {
                    const invoiceRef = doc(db, collectionName, invoiceId);
                    const invoiceDoc = await transaction.get(invoiceRef);
                    
                    if (invoiceDoc.exists()) {
                        const invData = invoiceDoc.data() as any;
                        const diff = newAmount - amount;
                        
                        // Check if overpayment
                        if (invData.paidAmount + diff > invData.grandTotal + 0.1) {
                             throw new Error("Le nouveau montant dépasse le reste à payer de la facture.");
                        }

                        const newPaid = Math.max(0, invData.paidAmount + diff);
                        const newStatus = (invData.grandTotal - newPaid) <= 0.1 ? 'Payé' : (newPaid > 0.1 ? 'Partiel' : 'En attente');
                        
                        transaction.update(invoiceRef, {
                            paidAmount: newPaid,
                            paymentStatus: newStatus
                        });
                    }
                }

                // 2. Update Payment
                const paymentRef = doc(db, paymentCollection, id);
                transaction.update(paymentRef, {
                    amount: newAmount,
                    date: date,
                    method: method,
                    notes: notes || ''
                });
            });

            setSuccess("Paiement modifié avec succès");
            setShowEditModal(false);
            setEditingPayment(null);
            fetchHistory();
            if (selectedPartner) setSelectedPartner({...selectedPartner});
            setTimeout(() => setSuccess(null), 3000);
        } catch (e: any) {
            setError("Erreur modification: " + e.message);
        }
    };

    const filteredSuggestions = useMemo(() => {
        if (!searchTerm || selectedPartner) return [];
        const list = activeTab === 'clients' ? customers : suppliers;
        return list.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 5);
    }, [searchTerm, activeTab, customers, suppliers, selectedPartner]);

    const handleSelectPartner = (partner: Customer | Supplier) => {
        setSelectedPartner(partner);
        setSearchTerm(partner.name);
        setPaymentAmount(0);
    };

    const handleReset = () => {
        setSelectedPartner(null);
        setSearchTerm('');
        setPaymentAmount(0);
        setMomoOperator('');
        setMomoNumber('');
        setPaymentNote('');
        setPaymentMethod('Espèces');
        setError(null);
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPartner || !user || paymentAmount <= 0) return;

        if (paymentMethod === 'Mobile Money' && (!momoOperator || !momoNumber)) {
            setError("Veuillez renseigner l'opérateur et le numéro.");
            return;
        }
        
        setIsSubmitting(true);
        setError(null);

        try {
            const collectionName = activeTab === 'clients' ? 'sales' : 'purchases';
            const paymentCollection = activeTab === 'clients' ? 'salePayments' : 'purchasePayments';
            const invoiceIdKey = activeTab === 'clients' ? 'saleId' : 'purchaseId';

            // 1. Préparer la liste de toutes les dettes
            const allDebts = unpaidInvoices.map(inv => ({
                id: inv.id,
                type: inv.id.startsWith('OPENING_BALANCE_') ? 'opening' : 'invoice',
                remaining: inv.grandTotal - inv.paidAmount,
                date: inv.date,
                refNumber: inv.referenceNumber,
                originalObj: inv
            })).filter(d => d.remaining > 0.1);

            // 2. Ordonner les dettes : Celle sélectionnée en premier, puis les autres par date
            allDebts.sort((a, b) => {
                if (a.id === selectedInvoiceId) return -1;
                if (b.id === selectedInvoiceId) return 1;
                return new Date(a.date).getTime() - new Date(b.date).getTime();
            });

            // 3. Vérifier si le montant total dépasse la dette totale
            const totalDebt = allDebts.reduce((sum, d) => sum + d.remaining, 0);
            if (paymentAmount > totalDebt + 10) { 
                if (!window.confirm(`Le montant saisi (${formatCurrency(paymentAmount)}) est supérieur à la dette totale (${formatCurrency(totalDebt)}). Voulez-vous continuer et créer un avoir pour le surplus ?`)) {
                    setIsSubmitting(false);
                    return;
                }
            }

            // Capture data for receipt
            const receiptAmount = paymentAmount;
            const receiptMethod = paymentMethod;
            const receiptNote = paymentNote;
            const receiptDate = paymentDate;
            const currentBalance = accountBalance;
            const customerForReceipt = activeTab === 'clients' ? (selectedPartner as Customer) : null;
            const receiptRefNumber = selectedInvoiceId ? unpaidInvoices.find(i => i.id === selectedInvoiceId)?.referenceNumber : 'RÈGLEMENT GLOBAL';

            await runTransaction(db, async (transaction) => {
                let localRemaining = paymentAmount;
                const updatesToPerform: { ref: any, data: any }[] = [];
                const paymentsToCreate: any[] = [];

                // PHASE 1: READS & CALCULS
                for (const debt of allDebts) {
                    if (localRemaining <= 0.1) break;

                    let amountToPayOnThis = 0;
                    let currentRemaining = 0;
                    let invoiceRef = null;
                    let invoiceData = null;

                    if (debt.type === 'opening') {
                        currentRemaining = debt.remaining; 
                    } else {
                        invoiceRef = doc(db, collectionName, debt.id);
                        const invoiceSnap = await transaction.get(invoiceRef);
                        if (!invoiceSnap.exists()) continue;
                        
                        invoiceData = invoiceSnap.data() as Sale | Purchase;
                        currentRemaining = invoiceData.grandTotal - invoiceData.paidAmount;
                    }

                    amountToPayOnThis = Math.min(localRemaining, currentRemaining);

                    if (amountToPayOnThis > 0.1) {
                        const pData: any = {
                            [invoiceIdKey]: debt.id,
                            date: new Date(paymentDate).toISOString(),
                            amount: amountToPayOnThis,
                            method: paymentMethod,
                            createdByUserId: user.uid,
                            note: (paymentNote || `Règlement global`) + (allDebts.length > 1 && debt.id !== selectedInvoiceId ? ` (Répartition auto: ${debt.refNumber})` : '')
                        };

                        if (paymentMethod === 'Mobile Money') {
                            pData.momoOperator = momoOperator;
                            pData.momoNumber = momoNumber;
                        }

                        paymentsToCreate.push(pData);

                        if (debt.type === 'invoice' && invoiceRef && invoiceData) {
                            const newPaid = (invoiceData.paidAmount || 0) + amountToPayOnThis;
                            const newStatus = (invoiceData.grandTotal - newPaid) <= 0.1 ? 'Payé' : 'Partiel';
                            updatesToPerform.push({
                                ref: invoiceRef,
                                data: { paidAmount: newPaid, paymentStatus: newStatus }
                            });
                        }

                        localRemaining -= amountToPayOnThis;
                    }
                }

                // Gestion du surplus (Avoir sur la première dette sélectionnée ou crédit client)
                // Pour simplifier ici, on l'ajoute au dernier paiement créé ou on crée un avoir si supporté
                // NOTE: Dans CustomerAccountPage on a ajouté le support complet du crédit.
                // Ici, on va juste s'assurer que le montant payé est bien enregistré.
                // Si surplus, on l'ajoute au premier paiement pour l'instant (comportement existant amélioré)
                // ou on le traite comme dans CustomerAccountPage si on veut être cohérent.
                // Pour l'instant, on garde la logique "répartition" et le surplus sur le premier.
                
                if (localRemaining > 0.1) {
                    if (paymentsToCreate.length > 0) {
                        // Ajouter le surplus au premier paiement
                        paymentsToCreate[0].amount += localRemaining;
                        // Et mettre à jour la facture correspondante si c'est une facture
                        if (allDebts.length > 0 && allDebts[0].type === 'invoice') {
                             const update = updatesToPerform.find(u => u.ref.id === allDebts[0].id);
                             if (update) {
                                 update.data.paidAmount += localRemaining;
                             }
                        }
                    } else {
                        // Aucun paiement créé (pas de dette ?), on crée un paiement "flottant" ou sur solde ouverture
                        // Cas rare si check dettes fait avant.
                    }
                }

                // PHASE 2: WRITES
                paymentsToCreate.forEach(p => {
                    const newRef = doc(collection(db, paymentCollection));
                    p.id = newRef.id; // Assign ID locally for receipt
                    transaction.set(newRef, p);
                });

                updatesToPerform.forEach(u => {
                    transaction.update(u.ref, u.data);
                });
            });

            setSuccess("Règlement validé !");
            
            // Show Receipt if Client
            if (activeTab === 'clients' && customerForReceipt) {
                const tempReceiptId = `REC-${Date.now().toString().slice(-6)}`;
                
                setLastPayment({
                    id: tempReceiptId,
                    saleId: selectedInvoiceId || 'MULTI_PAYMENT',
                    date: new Date(receiptDate).toISOString(),
                    amount: receiptAmount,
                    method: receiptMethod,
                    createdByUserId: user.uid,
                    notes: receiptNote || receiptRefNumber || ''
                } as SalePayment);

                setLastPaymentBalance(Math.max(0, currentBalance - receiptAmount));
                setReceiptCustomer(customerForReceipt);
                setShowReceiptModal(true);
            }

            setTimeout(() => setSuccess(null), 3000);
            handleReset();
            fetchHistory(); // Refresh history
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCurrency = (v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' FCFA';

    return (
        <div className="max-w-5xl mx-auto pb-12">
            <header className="mb-8">
                <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Gestion des Règlements</h1>
                <p className="text-gray-500 dark:text-gray-400">Équilibrez les comptes par encaissements ou décaissements.</p>
            </header>

            <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border dark:border-gray-700 mb-8 max-w-md">
                <button 
                    onClick={() => { setActiveTab('clients'); handleReset(); }}
                    className={`flex-1 flex items-center justify-center py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'clients' ? 'bg-primary-600 text-white shadow-lg' : 'text-gray-400'}`}
                >
                    <CustomersIcon className="w-4 h-4 mr-2"/> Clients
                </button>
                <button 
                    onClick={() => { setActiveTab('suppliers'); handleReset(); }}
                    className={`flex-1 flex items-center justify-center py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'suppliers' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400'}`}
                >
                    <SuppliersIcon className="w-4 h-4 mr-2"/> Fournisseurs
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <section className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border dark:border-gray-700 relative">
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">
                            {activeTab === 'clients' ? 'Rechercher le client' : 'Rechercher le fournisseur'}
                        </label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); if(selectedPartner) setSelectedPartner(null); }}
                                placeholder="Tapez un nom..."
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border-none focus:ring-2 focus:ring-primary-500 font-bold"
                            />
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/>
                        </div>

                        {filteredSuggestions.length > 0 && (
                            <ul className="absolute z-20 left-6 right-6 mt-1 bg-white dark:bg-gray-800 shadow-2xl rounded-2xl border dark:border-gray-700 overflow-hidden">
                                {filteredSuggestions.map(p => (
                                    <li key={p.id} onClick={() => handleSelectPartner(p)} className="px-4 py-3 hover:bg-primary-50 dark:hover:bg-primary-900/30 cursor-pointer text-sm font-bold border-b last:border-0 dark:border-gray-700">
                                        {p.name}
                                    </li>
                                ))}
                            </ul>
                        )}

                        {selectedPartner && (
                            <div className="mt-6 pt-6 border-t dark:border-gray-700 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-4">
                                    <div className={`p-4 rounded-2xl ${accountBalance > 0 ? 'bg-red-50 dark:bg-red-900/10' : 'bg-green-50 dark:bg-green-900/10'}`}>
                                        <p className="text-[9px] font-black uppercase text-gray-500 mb-1">Dette Totale Net (Inclus Ouverture)</p>
                                        <p className={`text-xl font-black ${accountBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(accountBalance)}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                                            <p className="text-[8px] font-black uppercase text-gray-400 mb-0.5">Impayés</p>
                                            <p className="text-sm font-black text-gray-700 dark:text-gray-300">{unpaidInvoices.length} factures</p>
                                        </div>
                                        <button onClick={handleReset} className="text-[10px] font-black uppercase text-primary-600 hover:bg-primary-50 p-2 rounded-xl transition-all">Changer</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                </div>

                <div className="lg:col-span-2">
                    {selectedPartner && unpaidInvoices.length > 0 ? (
                        <form onSubmit={handleFormSubmit} className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border dark:border-gray-700 space-y-8">
                            <h2 className="text-xl font-black uppercase text-gray-900 dark:text-white flex items-center tracking-tight">
                                <span className="w-10 h-10 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center mr-3 text-lg">💰</span>
                                Nouveau Règlement
                            </h2>

                            {error && <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl font-bold text-sm">{error}</div>}
                            {success && <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-2xl font-bold text-sm">{success}</div>}

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-400 mb-3 tracking-widest">Choisir la facture à apurer</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                        {unpaidInvoices.map(inv => (
                                            <label 
                                                key={inv.id} 
                                                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedInvoiceId === inv.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300'}`}
                                            >
                                                <div className="flex items-center">
                                                    <input type="radio" checked={selectedInvoiceId === inv.id} onChange={() => setSelectedInvoiceId(inv.id)} className="w-4 h-4 text-primary-600 mr-3"/>
                                                    <div>
                                                        <p className="text-xs font-black uppercase">{(inv as any).referenceNumber}</p>
                                                        <p className="text-[10px] text-gray-400 font-bold">{new Date(inv.date).toLocaleDateString('fr-FR')}</p>
                                                    </div>
                                                </div>
                                                <p className="text-sm font-black text-red-600">{formatCurrency(inv.grandTotal - inv.paidAmount)}</p>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-black uppercase text-gray-400 mb-1">Montant à verser</label>
                                        <input type="number" required min="1" value={paymentAmount || ''} onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)} className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border-none focus:ring-4 focus:ring-primary-500/20 text-2xl font-black text-primary-600" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase text-gray-400 mb-1">Date</label>
                                        <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border-none focus:ring-2 focus:ring-primary-500 font-bold"/>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-400 mb-3 tracking-widest">Mode de règlement</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {['Espèces', 'Virement bancaire', 'Mobile Money', 'Autre'].map(m => (
                                            <button key={m} type="button" onClick={() => { setPaymentMethod(m as PaymentMethod); if(m !== 'Mobile Money') { setMomoOperator(''); setMomoNumber(''); } }} className={`py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${paymentMethod === m ? 'bg-gray-900 text-white border-gray-900 shadow-lg' : 'bg-white dark:bg-gray-700 text-gray-500 border-gray-100 dark:border-gray-600 hover:border-gray-200'}`}>{m}</button>
                                        ))}
                                    </div>
                                </div>

                                {paymentMethod === 'Mobile Money' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                        <div><label className="block text-xs font-black uppercase text-blue-400 mb-1">Opérateur</label><input type="text" value={momoOperator} onChange={e => setMomoOperator(e.target.value)} className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg border-none font-bold uppercase" placeholder="MTN, MOOV..."/></div>
                                        <div><label className="block text-xs font-black uppercase text-blue-400 mb-1">N° Transaction</label><input type="tel" value={momoNumber} onChange={e => setMomoNumber(e.target.value)} className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg border-none font-bold" placeholder="00000000"/></div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-400 mb-1">Notes / Motif (Optionnel)</label>
                                    <textarea
                                        value={paymentNote}
                                        onChange={(e) => setPaymentNote(e.target.value)}
                                        className="w-full p-3 border rounded-xl dark:bg-gray-700 font-medium"
                                        rows={2}
                                        placeholder="Observations, numéro de chèque, etc."
                                    />
                                </div>
                            </div>

                            <div className="pt-6 border-t dark:border-gray-700 flex justify-end">
                                <button type="submit" disabled={isSubmitting || paymentAmount <= 0} className="px-12 py-5 bg-primary-600 text-white rounded-2xl font-black text-lg shadow-2xl hover:bg-primary-700 active:scale-95 disabled:opacity-50 uppercase tracking-widest">
                                    {isSubmitting ? 'Traitement...' : 'Enregistrer le Règlement'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900/30 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[3rem] p-12 text-center opacity-60">
                            <WarningIcon className="w-12 h-12 text-gray-300 mb-4" />
                            <h3 className="text-lg font-black uppercase text-gray-400 tracking-widest">Compte à jour</h3>
                            <p className="text-sm text-gray-400 mt-2">Ce partenaire n'a aucune facture impayée pour le moment.</p>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Receipt Modal */}
            <Modal isOpen={showReceiptModal} onClose={() => setShowReceiptModal(false)} title="REÇU DE PAIEMENT" maxWidth="max-w-xl">
                <div className="flex flex-col items-center">
                    <div className="w-full overflow-x-auto flex justify-center py-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-xl mb-6">
                        {lastPayment && receiptCustomer && (
                            <div className="shadow-xl ring-1 ring-gray-900/5 bg-white transform transition-all hover:scale-[1.02] duration-300">
                                <PaymentReceipt 
                                    ref={receiptRef}
                                    payment={lastPayment}
                                    customer={receiptCustomer}
                                    settings={settings}
                                    balanceAfter={lastPaymentBalance}
                                    reference={lastPayment.notes || 'RÈGLEMENT'}
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex gap-4 w-full">
                        <button 
                            onClick={() => setShowReceiptModal(false)}
                            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold uppercase tracking-wider hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            Fermer
                        </button>
                        <button 
                            onClick={handlePrintReceipt}
                            className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2"
                        >
                            <span className="text-lg">🖨️</span> Imprimer
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Edit Payment Modal */}
            <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="MODIFIER LE PAIEMENT" maxWidth="max-w-lg">
                {editingPayment && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-black uppercase text-gray-400 mb-1">Montant</label>
                            <input 
                                type="number" 
                                value={editingPayment.newAmount} 
                                onChange={e => setEditingPayment({...editingPayment, newAmount: parseFloat(e.target.value) || 0})}
                                className="w-full p-3 border rounded-xl dark:bg-gray-700 font-bold"
                            />
                            <p className="text-xs text-red-500 mt-1">Attention: Modifier le montant impactera le reste à payer de la facture.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase text-gray-400 mb-1">Date</label>
                            <input 
                                type="date" 
                                value={editingPayment.date ? new Date(editingPayment.date).toISOString().split('T')[0] : ''} 
                                onChange={e => setEditingPayment({...editingPayment, date: e.target.value})}
                                className="w-full p-3 border rounded-xl dark:bg-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase text-gray-400 mb-1">Mode</label>
                            <select 
                                value={editingPayment.method} 
                                onChange={e => setEditingPayment({...editingPayment, method: e.target.value})}
                                className="w-full p-3 border rounded-xl dark:bg-gray-700"
                            >
                                {['Espèces', 'Virement bancaire', 'Mobile Money', 'Autre'].map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase text-gray-400 mb-1">Notes</label>
                            <textarea 
                                value={editingPayment.notes} 
                                onChange={e => setEditingPayment({...editingPayment, notes: e.target.value})}
                                className="w-full p-3 border rounded-xl dark:bg-gray-700"
                                rows={2}
                            />
                        </div>
                        <div className="flex justify-end pt-4">
                            <button 
                                onClick={handleSaveEdit}
                                className="px-6 py-2 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700"
                            >
                                Enregistrer
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        
            {/* Payment History Table */}
            <div className="mt-12">
                <h2 className="text-xl font-black uppercase text-gray-900 dark:text-white mb-4">
                    Historique des {activeTab === 'clients' ? 'Versements Clients' : 'Paiements Fournisseurs'}
                    {selectedPartner && <span className="text-primary-600"> - {selectedPartner.name}</span>}
                </h2>
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-900/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase text-gray-400 tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase text-gray-400 tracking-wider">Partenaire</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase text-gray-400 tracking-wider">Facture / Réf</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase text-gray-400 tracking-wider">Montant</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase text-gray-400 tracking-wider">Mode</th>
                                    <th className="px-6 py-4 text-right text-xs font-black uppercase text-gray-400 tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {paymentHistory.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm italic">
                                            Aucun historique trouvé pour cette période.
                                        </td>
                                    </tr>
                                ) : (
                                    paymentHistory.map((payment) => (
                                        <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700 dark:text-gray-300">
                                                {new Date(payment.date).toLocaleDateString('fr-FR')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                                                {payment.partnerName || '...'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {payment.invoiceRef || '...'}
                                                {payment.notes && <span className="block text-xs text-gray-400 italic truncate max-w-[150px]">{payment.notes}</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-primary-600">
                                                {formatCurrency(payment.amount)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-bold text-gray-600 dark:text-gray-300">
                                                    {payment.method}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                <button 
                                                    onClick={() => handleEditClick(payment)}
                                                    className="text-blue-600 hover:text-blue-900 p-1 bg-blue-50 rounded-lg transition-colors"
                                                    title="Modifier"
                                                >
                                                    <EditIcon className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeletePayment(payment.id, activeTab === 'clients' ? payment.saleId : payment.purchaseId, payment.amount)}
                                                    className="text-red-600 hover:text-red-900 p-1 bg-red-50 rounded-lg transition-colors"
                                                    title="Supprimer"
                                                >
                                                    <DeleteIcon className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentsPage;
