
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { Customer, Supplier, Sale, Purchase, SalePayment, Payment, PaymentMethod, PaymentStatus, AppSettings } from '../types';
import { useAuth } from '../hooks/useAuth';
import { SearchIcon, CustomersIcon, SuppliersIcon, WarningIcon, CheckIcon, EditIcon, DeleteIcon, PrintIcon, WhatsappIcon } from '../constants';
import Modal from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { PaymentReceipt } from '../components/PaymentReceipt';
import { PaymentListPrint } from '../components/PaymentListPrint';
import { useReactToPrint } from 'react-to-print';
import { formatCurrency } from '../utils/formatters';
import { useData } from '../context/DataContext';
import { shareInvoiceViaWhatsapp, normalizePhoneNumber } from '../utils/whatsappUtils';

const PaymentsPage: React.FC = () => {
    const { user } = useAuth();
    const { customers, suppliers, settings, loading: dataLoading } = useData();
    const [activeTab, setActiveTab] = useState<'clients' | 'suppliers'>('clients');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Receipt State
    const receiptRef = useRef<HTMLDivElement>(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [lastPayment, setLastPayment] = useState<SalePayment | null>(null);
    const [lastPaymentBalance, setLastPaymentBalance] = useState(0);
    const [receiptCustomer, setReceiptCustomer] = useState<Customer | null>(null);

    // WhatsApp Sharing State
    const [showShareModal, setShowShareModal] = useState(false);
    const [sharePhoneNumber, setSharePhoneNumber] = useState('');
    const [isSharing, setIsSharing] = useState(false);
    
    // Hidden receipt ref for reliable capture
    const hiddenReceiptRef = useRef<HTMLDivElement>(null);

    // Data lists
    // const [customers, setCustomers] = useState<Customer[]>([]); // Provided by useData
    // const [suppliers, setSuppliers] = useState<Supplier[]>([]); // Provided by useData

    const handlePrintReceipt = useReactToPrint({ contentRef: receiptRef });
    
    // Handle WhatsApp sharing
    const handleShareWhatsapp = async () => {
        if (!lastPayment || !receiptCustomer) {
            console.warn("Données du reçu manquantes:", { lastPayment, receiptCustomer });
            alert("Impossible de partager: données du reçu manquantes.");
            return;
        }

        const cleanPhone = normalizePhoneNumber(sharePhoneNumber);
        if (!cleanPhone || cleanPhone.length < 8) {
            alert("Numéro invalide. Veuillez corriger.");
            return;
        }

        setIsSharing(true);
        try {
            console.log("🔍 Cherche l'élément du reçu...");
            
            // Attendre un court instant pour s'assurer que le rendu est stable
            await new Promise(resolve => setTimeout(resolve, 300));

            // Utiliser la ref CACHÉE pour la capture (toujours présente dans le DOM)
            let receiptElement = hiddenReceiptRef.current;
            console.log("📦 Reçu trouvé via Hidden Ref:", !!receiptElement);

            if (!receiptElement) {
                // Fallback sur la ref visible (dans le modal)
                receiptElement = receiptRef.current;
                console.log("📦 Reçu trouvé via Visible Ref:", !!receiptElement);
            }
            
            // Fallback si la ref est vide (cas rares de re-render)
            if (!receiptElement) {
                console.warn("⚠️ Ref vide, tentative de recherche via ID...");
                // On utilise un ID unique qu'on va ajouter au composant PaymentReceipt
                receiptElement = document.getElementById('payment-receipt-capture') as HTMLDivElement;
                
                if (!receiptElement) {
                    // Chercher le hidden receipt par ID spécifique
                    receiptElement = document.getElementById('hidden-payment-receipt') as HTMLDivElement;
                }
            }
            
            if (!receiptElement) {
                throw new Error("Reçu non trouvé (Toutes les méthodes de recherche ont échoué)");
            }

            const messageText = `*${settings?.companyName || 'ETS COUL & FRERES'}*\n\nBonjour *${receiptCustomer.name}*,\n\nVoici votre reçu de versement.\n\n- *Montant:* ${formatCurrency(lastPayment.amount)}\n- *Date:* ${new Date(lastPayment.date).toLocaleDateString('fr-FR')}\n\nMerci !`;

            console.log("✅ Appel de shareInvoiceViaWhatsapp...");
            await shareInvoiceViaWhatsapp({
                element: receiptElement,
                filename: `Recu_Versement_${lastPayment.id}.pdf`,
                phone: cleanPhone,
                message: messageText
            });
            console.log("✅ Partage réussi");
        } catch (err: any) {
            console.error("❌ Erreur lors du partage:", err);
            console.error("Message d'erreur:", err.message);
            console.error("Stack:", err.stack);
            alert(`Une erreur est survenue : ${err.message}`);
        } finally {
            setIsSharing(false);
            setShowShareModal(false);
        }
    };
    
    // Print List State
    const [isPrintListModalOpen, setIsPrintListModalOpen] = useState(false);
    const printListRef = useRef<HTMLDivElement>(null);
    const handlePrintList = useReactToPrint({ contentRef: printListRef });
    
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
    
    // History Filters & Pagination
    const [historySearch, setHistorySearch] = useState('');
    const [historyStartDate, setHistoryStartDate] = useState('');
    const [historyEndDate, setHistoryEndDate] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const HISTORY_ITEMS_PER_PAGE = 20;

    // Debtors List State
    const [debtors, setDebtors] = useState<{partner: Customer | Supplier, balance: number}[]>([]);
    const [loadingDebtors, setLoadingDebtors] = useState(false);

    useEffect(() => {
        if (!dataLoading) {
            setLoading(false);
        }
    }, [dataLoading]);

    // Fetch debtors list
    useEffect(() => {
        const fetchDebtorsList = async () => {
            if (customers.length === 0 && suppliers.length === 0) return;
            
            setLoadingDebtors(true);
            try {
                const isClient = activeTab === 'clients';
                const collName = isClient ? 'sales' : 'purchases';
                const partnerIdField = isClient ? 'customerId' : 'supplierId';
                const partners = isClient ? customers : suppliers;

                console.log("Fetching debtors for:", activeTab);

                // 1. Get unpaid invoices
                const { data: unpaidData, error: unpaidError } = await supabase
                    .from(collName)
                    .select('*')
                    .neq('paymentStatus', 'Payé');
                
                if (unpaidError) throw unpaidError;

                console.log("Unpaid invoices found:", unpaidData?.length);

                // 2. Aggregate debts
                const debtMap = new Map<string, number>();
                
                // Add debts from invoices
                (unpaidData || []).forEach((inv: any) => {
                    const pid = inv[partnerIdField];
                    if (pid) {
                        const debt = Number(inv.grandTotal || 0) - Number(inv.paidAmount || 0);
                        if (debt > 0.1) {
                            debtMap.set(pid, (debtMap.get(pid) || 0) + debt);
                        }
                    }
                });

                // 3. Add opening balances
                partners.forEach(p => {
                    if (p.openingBalance && Number(p.openingBalance) > 0) {
                        debtMap.set(p.id, (debtMap.get(p.id) || 0) + Number(p.openingBalance));
                    }
                });

                // 4. Create list
                const debtorsList = partners
                    .filter(p => !p.isArchived && debtMap.has(p.id) && (debtMap.get(p.id) || 0) > 0.1)
                    .map(p => ({
                        partner: p,
                        balance: debtMap.get(p.id) || 0
                    }))
                    .sort((a, b) => b.balance - a.balance)
                    .slice(0, 10);

                console.log("Debtors list calculated:", debtorsList.length);
                setDebtors(debtorsList);

            } catch (err) {
                console.error("Error fetching debtors", err);
            } finally {
                setLoadingDebtors(false);
            }
        };

        fetchDebtorsList();
    }, [activeTab, customers, suppliers]);

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
                let openingBalance = (selectedPartner as any).openingBalance || 0;
                let balance = openingBalance;
                let paidOnOpening = 0;

                if (openingBalance > 0) {
                    const paymentTable = activeTab === 'clients' ? 'sale_payments' : 'purchase_payments';
                    const idField = activeTab === 'clients' ? 'saleId' : 'purchaseId';
                    const openingBalanceId = `OPENING_BALANCE_${selectedPartner.id}`;
                    
                    const { data: openPayments, error: openError } = await supabase
                        .from(paymentTable)
                        .select('amount')
                        .eq(idField, openingBalanceId);
                    
                    if (openError) throw openError;
                    
                    paidOnOpening = (openPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
                    balance = Math.max(0, openingBalance - paidOnOpening);

                    if (balance > 0.1) {
                         const openingInvoice: any = {
                            id: openingBalanceId,
                            referenceNumber: "SOLDE D'OUVERTURE",
                            date: (selectedPartner as any).openingBalanceDate || new Date().toISOString(),
                            grandTotal: openingBalance,
                            paidAmount: paidOnOpening,
                            paymentStatus: 'Partiel',
                            customerId: selectedPartner.id,
                            supplierId: selectedPartner.id
                        };
                        invoices.push(openingInvoice);
                    }
                }

                if (activeTab === 'clients') {
                    const { data: sales, error: salesError } = await supabase
                        .from('sales')
                        .select('*')
                        .eq('customerId', selectedPartner.id);
                    
                    if (salesError) throw salesError;

                    const unpaidSales = (sales || []).filter(s => s.paymentStatus !== 'Payé');
                    invoices = [...invoices, ...unpaidSales];
                    (sales || []).forEach(s => balance += (s.grandTotal - s.paidAmount));
                } else {
                    const { data: purchases, error: purError } = await supabase
                        .from('purchases')
                        .select('*')
                        .eq('supplierId', selectedPartner.id);
                    
                    if (purError) throw purError;

                    const unpaidPurchases = (purchases || []).filter(p => p.paymentStatus !== 'Payé');
                    invoices = [...invoices, ...unpaidPurchases];
                    (purchases || []).forEach(p => balance += (p.grandTotal - p.paidAmount));
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
            const table = activeTab === 'clients' ? 'sale_payments' : 'purchase_payments';
            let query = supabase.from(table).select('*');
            
            if (historyStartDate) {
                const start = new Date(historyStartDate);
                start.setHours(0, 0, 0, 0);
                query = query.gte('date', start.toISOString());
            } else {
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                query = query.gte('date', threeMonthsAgo.toISOString());
            }

            if (historyEndDate) {
                const end = new Date(historyEndDate);
                end.setHours(23, 59, 59, 999);
                query = query.lte('date', end.toISOString());
            }

            const { data: paymentsData, error: pError } = await query;
            if (pError) throw pError;
            
            let payments = paymentsData || [];
            payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            if (selectedPartner) {
                const invoiceTable = activeTab === 'clients' ? 'sales' : 'purchases';
                const partnerField = activeTab === 'clients' ? 'customerId' : 'supplierId';
                
                const { data: invoicesData, error: iError } = await supabase
                    .from(invoiceTable)
                    .select('id')
                    .eq(partnerField, selectedPartner.id);
                
                if (iError) throw iError;
                
                const partnerInvoiceIds = new Set((invoicesData || []).map(d => d.id));
                partnerInvoiceIds.add(`OPENING_BALANCE_${selectedPartner.id}`);
                
                const idKey = activeTab === 'clients' ? 'saleId' : 'purchaseId';
                payments = payments.filter(p => partnerInvoiceIds.has(p[idKey]));
            } else {
                payments = payments.slice(0, 100); 
            }
            
            // Enhance with invoice info
            const invoiceTable = activeTab === 'clients' ? 'sales' : 'purchases';
            const enhancedPayments = await Promise.all(payments.map(async (p) => {
                const idKey = activeTab === 'clients' ? 'saleId' : 'purchaseId';
                const invId = p[idKey];
                
                if (invId && (invId.startsWith('OPENING_BALANCE_') || invId.startsWith('CREDIT_BALANCE_'))) {
                    const partnerId = invId.replace('OPENING_BALANCE_', '').replace('CREDIT_BALANCE_', '');
                    const partnerList = activeTab === 'clients' ? customers : suppliers;
                    const partner = partnerList.find(x => x.id === partnerId);
                    return { ...p, invoiceRef: invId.startsWith('OPENING_BALANCE_') ? "SOLDE D'OUVERTURE" : "NOTE DE CRÉDIT", partnerName: partner?.name || 'Inconnu', partnerId };
                }
                
                let pName = selectedPartner?.name || '...';
                let pId = selectedPartner?.id || '';
                let refNum = '...';

                if (!selectedPartner) {
                    const partnerList = activeTab === 'clients' ? customers : suppliers;
                    if (activeTab === 'clients' && p.customerId) {
                         const c = partnerList.find(x => x.id === p.customerId);
                         if (c) { pName = c.name; pId = c.id; }
                    } else if (activeTab === 'suppliers' && p.supplierId) {
                         const s = partnerList.find(x => x.id === p.supplierId);
                         if (s) { pName = s.name; pId = s.id; }
                    }
                }

                if (!invId) {
                     return { ...p, invoiceRef: '-', partnerName: pName === '...' ? 'Non lié' : pName, partnerId: pId };
                }
                
                if (!selectedPartner) {
                    try {
                        const { data: invData, error: invError } = await supabase
                            .from(invoiceTable)
                            .select('*')
                            .eq('id', invId)
                            .single();
                            
                        if (!invError && invData) {
                            refNum = invData.referenceNumber || 'N/A';
                            
                            const partnerList = activeTab === 'clients' ? customers : suppliers;
                            const partnerId = activeTab === 'clients' ? invData.customerId : invData.supplierId;
                            pId = partnerId;
                            
                            if (partnerId) {
                                const found = partnerList.find(x => x.id === partnerId);
                                if (found) {
                                    pName = found.name;
                                } else {
                                    const { data: pData } = await supabase
                                        .from(activeTab === 'clients' ? 'customers' : 'suppliers')
                                        .select('name')
                                        .eq('id', partnerId)
                                        .single();
                                    
                                    pName = pData ? pData.name : 'Introuvable';
                                }
                            } else {
                                pName = 'Non assigné';
                            }
                        } else {
                            refNum = 'Supprimée';
                            pName = 'Inconnu';
                        }
                    } catch (e) {
                        console.error("Error fetching invoice for payment:", p.id, e);
                        refNum = 'Erreur';
                    }
                } else {
                     const inv = unpaidInvoices.find(i => i.id === invId);
                     if (inv) {
                        refNum = inv.referenceNumber;
                        pId = selectedPartner.id;
                     }
                     else {
                         try {
                             const { data: invData } = await supabase
                                 .from(invoiceTable)
                                 .select('referenceNumber')
                                 .eq('id', invId)
                                 .single();
                             if (invData) {
                                 refNum = invData.referenceNumber || 'N/A';
                                 pId = selectedPartner.id;
                             } else {
                                 refNum = 'Supprimée';
                             }
                         } catch (e) {
                             console.error("Error fetching invoice for selected partner payment:", e);
                         }
                     }
                }
                
                return { ...p, invoiceRef: refNum, partnerName: pName, partnerId: pId };
            }));
            
            setPaymentHistory(enhancedPayments);
        } catch (err) {
            console.error("Error fetching history", err);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [activeTab, selectedPartner, customers, suppliers, historyStartDate, historyEndDate]); // Refetch when filters change

    const filteredHistory = useMemo(() => {
        return paymentHistory.filter(p => {
            if (!historySearch) return true;
            const searchLower = historySearch.toLowerCase();
            return (
                (p.partnerName && p.partnerName.toLowerCase().includes(searchLower)) ||
                (p.invoiceRef && p.invoiceRef.toLowerCase().includes(searchLower)) ||
                (p.notes && p.notes.toLowerCase().includes(searchLower)) ||
                (p.amount && p.amount.toString().includes(searchLower))
            );
        });
    }, [paymentHistory, historySearch]);

    const paginatedHistory = useMemo(() => {
        const start = (historyPage - 1) * HISTORY_ITEMS_PER_PAGE;
        return filteredHistory.slice(start, start + HISTORY_ITEMS_PER_PAGE);
    }, [filteredHistory, historyPage]);
    
    const totalHistoryPages = Math.ceil(filteredHistory.length / HISTORY_ITEMS_PER_PAGE);

    // Calcul des totaux
    const totalGlobalAmount = useMemo(() => filteredHistory.reduce((sum, p) => sum + (p.amount || 0), 0), [filteredHistory]);
    const totalPageAmount = useMemo(() => paginatedHistory.reduce((sum, p) => sum + (p.amount || 0), 0), [paginatedHistory]);

    const handleDeletePayment = async (paymentId: string, invoiceId: string, amount: number) => {
        if (invoiceId && invoiceId.startsWith('CREDIT_BALANCE_')) {
            alert("Impossible de supprimer cette entrée ici. Veuillez supprimer la Note de Crédit correspondante dans la page 'Avoirs'.");
            return;
        }

        if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce paiement ? Cela mettra à jour le solde de la facture.")) return;

        try {
            const table = activeTab === 'clients' ? 'sales' : 'purchases';
            const paymentTable = activeTab === 'clients' ? 'sale_payments' : 'purchase_payments';
            
            if (invoiceId && !invoiceId.startsWith('OPENING_BALANCE_')) {
                const { data: invData, error: fError } = await supabase
                    .from(table)
                    .select('*')
                    .eq('id', invoiceId)
                    .single();

                if (!fError && invData) {
                     const newPaid = Math.max(0, (invData.paidAmount || 0) - amount);
                     const newStatus = (invData.grandTotal - newPaid) <= 0.1 ? 'Payé' : (newPaid > 0.1 ? 'Partiel' : 'En attente');
                     
                     await supabase
                        .from(table)
                        .update({ paidAmount: newPaid, paymentStatus: newStatus })
                        .eq('id', invoiceId);
                }
            }

            await supabase.from(paymentTable).delete().eq('id', paymentId);
            
            setSuccess("Paiement supprimé avec succès");
            fetchHistory(); 
            if (selectedPartner) {
                setSelectedPartner({...selectedPartner}); 
            }
            setTimeout(() => setSuccess(null), 3000);
        } catch (e: any) {
            console.error(e);
            setError("Erreur lors de la suppression: " + e.message);
        }
    };

    const handleHistoryReprint = (payment: any) => {
        // We need customer object
        if (activeTab !== 'clients') {
            alert("L'impression des reçus n'est disponible que pour les clients.");
            return;
        }

        // Try to find customer in the already loaded list first
        let cust = customers.find(c => c.id === payment.partnerId);
        
        // If not found (maybe payment loaded without full partner link or pagination issue), try to find by name match as fallback or fetch
        if (!cust && payment.partnerName) {
             cust = customers.find(c => c.name === payment.partnerName);
        }

        if (!cust) {
            // Last resort: if we have partnerId but it wasn't in the initial list (unlikely if we load all customers, but possible if large list)
            // Or if partnerId is missing from the payment object in history.
            // Let's check if we can fetch it.
            if (payment.partnerId) {
                 // Async fetch not ideal here without refactoring this handler to async.
                 // Let's assume if it's not in the list, it might be a data consistency issue or 'Inconnu'.
                 alert(`Client introuvable (ID: ${payment.partnerId}).`);
            } else {
                 alert("Client introuvable pour ce paiement (ID manquant).");
            }
            return;
        }

        setLastPayment({
            id: payment.id,
            saleId: payment.saleId,
            date: payment.date,
            amount: payment.amount,
            method: payment.method,
            createdByUserId: payment.createdByUserId,
            notes: payment.notes || payment.invoiceRef || ''
        } as SalePayment);

        setReceiptCustomer(cust);
        setLastPaymentBalance(0); 
        setShowReceiptModal(true);
    };

    const handleEditClick = (payment: any) => {
        setEditingPayment({ ...payment, newAmount: payment.amount });
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingPayment) return;
        const { id, amount, newAmount, date, method, notes, saleId, purchaseId } = editingPayment;
        const invoiceId = activeTab === 'clients' ? saleId : purchaseId;

        try {
            const table = activeTab === 'clients' ? 'sales' : 'purchases';
            const paymentTable = activeTab === 'clients' ? 'sale_payments' : 'purchase_payments';
            
            if (Math.abs(newAmount - amount) > 0.1 && invoiceId && !invoiceId.startsWith('OPENING_BALANCE_')) {
                const { data: invData, error: fError } = await supabase
                    .from(table)
                    .select('*')
                    .eq('id', invoiceId)
                    .single();

                if (!fError && invData) {
                    const diff = newAmount - amount;
                    if ((invData.paidAmount || 0) + diff > (invData.grandTotal || 0) + 0.1) {
                         throw new Error("Le nouveau montant dépasse le reste à payer de la facture.");
                    }

                    const newPaid = Math.max(0, (invData.paidAmount || 0) + diff);
                    const newStatus = ((invData.grandTotal || 0) - newPaid) <= 0.1 ? 'Payé' : (newPaid > 0.1 ? 'Partiel' : 'En attente');
                    
                    await supabase
                        .from(table)
                        .update({ paidAmount: newPaid, paymentStatus: newStatus })
                        .eq('id', invoiceId);
                }
            }

            await supabase
                .from(paymentTable)
                .update({ amount: newAmount, date, method, notes: notes || '' })
                .eq('id', id);

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
        return list
            .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .filter(p => !p.isArchived) // Filter out archived in search
            .slice(0, 2); // Limit to 2 suggestions
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
            const table = activeTab === 'clients' ? 'sales' : 'purchases';
            const paymentTable = activeTab === 'clients' ? 'sale_payments' : 'purchase_payments';
            const invoiceIdKey = activeTab === 'clients' ? 'saleId' : 'purchaseId';

            // 1. Préparer la liste de toutes les dettes
            const allDebts = unpaidInvoices.map(inv => ({
                id: inv.id,
                type: inv.id?.startsWith('OPENING_BALANCE_') ? 'opening' : 'invoice',
                remaining: inv.grandTotal - inv.paidAmount,
                date: inv.date,
                refNumber: inv.referenceNumber,
                originalObj: inv
            })).filter(d => d.remaining > 0.1);

            // 2. Ordonner les dettes
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

            let localRemaining = paymentAmount;
            const createdPayments: any[] = [];

            for (const debt of allDebts) {
                if (localRemaining <= 0.1) break;

                let amountToPayOnThis = 0;
                let currentRemaining = 0;
                let invoiceData = null;

                if (debt.type === 'opening') {
                    currentRemaining = debt.remaining; 
                } else {
                     // Fetch latest invoice data
                     const { data: fetchInv } = await supabase.from(table).select('*').eq('id', debt.id).single();
                    
                    if (!fetchInv) {
                        console.error("Error fetching invoice", debt.id);
                        continue;
                    }
                    
                    invoiceData = fetchInv;
                    currentRemaining = (invoiceData.grandTotal || 0) - (invoiceData.paidAmount || 0);
                }

                amountToPayOnThis = Math.min(localRemaining, currentRemaining);

                if (amountToPayOnThis > 0.1) {
                    const now = new Date();
                    const pData: any = {
                        id: crypto.randomUUID(),
                        [invoiceIdKey]: debt.id,
                        date: paymentDate.includes('T') ? paymentDate : `${paymentDate}T${now.toISOString().split('T')[1]}`,
                        amount: amountToPayOnThis,
                        method: paymentMethod,
                        createdByUserId: user.uid,
                        notes: (paymentNote || `Règlement global`) + (allDebts.length > 1 && debt.id !== selectedInvoiceId ? ` (Répartition auto: ${debt.refNumber})` : '')
                    };

                    if (paymentMethod === 'Mobile Money') {
                        pData.momoOperator = momoOperator;
                        pData.momoNumber = momoNumber;
                    }

                    // Insert Payment
                    await supabase.from(paymentTable).insert(pData);
                    
                    createdPayments.push(pData);

                    // Update Invoice
                    if (debt.type === 'invoice' && invoiceData) {
                        const newPaid = (invoiceData.paidAmount || 0) + amountToPayOnThis;
                        const newStatus = (invoiceData.grandTotal - newPaid) <= 0.1 ? 'Payé' : 'Partiel';
                        
                        await supabase.from(table).update({ paidAmount: newPaid, paymentStatus: newStatus }).eq('id', debt.id);
                    }

                    localRemaining -= amountToPayOnThis;
                }
            }

            // Handle Surplus
            if (localRemaining > 0.1) {
                if (createdPayments.length > 0) {
                     const firstPayment = createdPayments[0];
                     const newAmount = firstPayment.amount + localRemaining;
                     
                     await supabase.from(paymentTable).update({ amount: newAmount }).eq('id', firstPayment.id);
                     
                     firstPayment.amount = newAmount;

                     const debtId = firstPayment[invoiceIdKey];
                     if (debtId && !debtId.startsWith('OPENING_BALANCE_')) {
                          const { data: invData } = await supabase.from(table).select('*').eq('id', debtId).single();
                          if (invData) {
                              const newPaid = (invData.paidAmount || 0) + localRemaining;
                              await supabase.from(table).update({ paidAmount: newPaid }).eq('id', debtId);
                          }
                     }
                }
            }

            setSuccess("Règlement validé !");
            
            // Show Receipt if Client
            if (activeTab === 'clients' && customerForReceipt) {
                 const tempReceiptId = createdPayments.length > 0 ? createdPayments[0].id : `REC-${Date.now().toString().slice(-6)}`;
                 
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
            console.error(err);
            setError(err.message || "Erreur lors du paiement");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full px-4 pb-12">
            <header className="mb-8 max-w-7xl mx-auto">
                <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Gestion des Règlements</h1>
                <p className="text-gray-500 dark:text-gray-400">Équilibrez les comptes par encaissements ou décaissements.</p>
            </header>

            <div className="max-w-7xl mx-auto mb-8">
                <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border dark:border-gray-700 max-w-md">
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
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

                        {/* Suggestions or Debtors List */}
                        {((filteredSuggestions.length > 0) || (!searchTerm && !selectedPartner)) && (
                            <div className={`absolute z-20 left-6 right-6 mt-1 bg-white dark:bg-gray-800 shadow-2xl rounded-2xl border dark:border-gray-700 overflow-hidden max-h-80 overflow-y-auto custom-scrollbar ${!searchTerm && debtors.length === 0 ? 'hidden' : ''}`}>
                                {searchTerm ? (
                                    filteredSuggestions.map(p => (
                                        <div key={p.id} onClick={() => handleSelectPartner(p)} className="px-4 py-3 hover:bg-primary-50 dark:hover:bg-primary-900/30 cursor-pointer text-sm font-bold border-b last:border-0 dark:border-gray-700">
                                            {p.name}
                                        </div>
                                    ))
                                ) : (
                                    <>
                                        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 text-[10px] font-black uppercase text-gray-500 sticky top-0 border-b dark:border-gray-600 flex justify-between items-center">
                                            <span>{activeTab === 'clients' ? 'Clients Débiteurs' : 'Fournisseurs (Dettes)'} ({debtors.length})</span>
                                            {loadingDebtors && <span className="animate-pulse">...</span>}
                                        </div>
                                        {debtors.map(({partner, balance}) => (
                                            <div key={partner.id} onClick={() => handleSelectPartner(partner)} className="px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer text-sm font-bold border-b last:border-0 dark:border-gray-700 flex justify-between items-center group transition-colors">
                                                <div>
                                                    <span className={`group-hover:text-primary-600 ${partner.isArchived ? 'text-gray-400 line-through decoration-red-500' : ''}`}>{partner.name}</span>
                                                    {partner.isArchived && <span className="ml-2 text-[10px] bg-gray-200 text-gray-600 px-1 rounded">Archivé</span>}
                                                </div>
                                                <span className="text-red-600 bg-red-100 dark:bg-red-900/40 px-2 py-1 rounded-lg text-xs font-black">{formatCurrency(balance)}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
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
                                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl border-2 border-green-200 dark:border-green-800 shadow-sm">
                                        <label className="block text-xs font-black uppercase text-green-700 dark:text-green-400 mb-1 tracking-widest">Montant à verser</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                required 
                                                min="1" 
                                                value={paymentAmount || ''} 
                                                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)} 
                                                className="w-full p-3 bg-white dark:bg-gray-900 rounded-xl border-2 border-green-300 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 text-3xl font-black text-green-700 dark:text-green-400 text-center shadow-inner" 
                                                placeholder="0"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600/50 font-black text-sm">FCFA</span>
                                        </div>
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
                    {/* ... buttons ... */}
                    <div className="flex gap-4 w-full">
                        <button 
                            onClick={() => setShowReceiptModal(false)}
                            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold uppercase tracking-wider hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            Fermer
                        </button>
                        <button 
                            onClick={() => {
                                setSharePhoneNumber(receiptCustomer?.whatsapp || '');
                                setShowShareModal(true);
                            }}
                            className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl font-black uppercase tracking-widest shadow-xl hover:bg-green-600 transition-all flex items-center justify-center gap-2"
                            title="Partager via WhatsApp"
                        >
                            <WhatsappIcon className="w-5 h-5" /> WhatsApp
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

            {/* Hidden Receipt for Capture */}
            <div style={{ position: 'absolute', top: -9999, left: -9999, visibility: 'hidden' }}>
                {lastPayment && receiptCustomer && (
                    <div id="hidden-payment-receipt">
                         <PaymentReceipt 
                            ref={hiddenReceiptRef}
                            payment={lastPayment}
                            customer={receiptCustomer}
                            settings={settings}
                            balanceAfter={lastPaymentBalance}
                            reference={lastPayment.notes || 'RÈGLEMENT'}
                        />
                    </div>
                )}
            </div>

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

             {/* Print List Modal */}
             <Modal isOpen={isPrintListModalOpen} onClose={() => setIsPrintListModalOpen(false)} title="IMPRIMER LISTE PAIEMENTS" maxWidth="max-w-4xl">
                <div className="flex flex-col items-center p-6">
                    <div className="w-full overflow-auto bg-gray-100 dark:bg-gray-700 p-4 rounded-xl mb-6 shadow-inner max-h-[70vh]">
                        <div className="transform scale-90 origin-top">
                             <PaymentListPrint 
                                ref={printListRef}
                                payments={filteredHistory}
                                settings={settings}
                                title={`Historique ${activeTab === 'clients' ? 'Versements Clients' : 'Paiements Fournisseurs'}`}
                                period={historyStartDate && historyEndDate ? `${new Date(historyStartDate).toLocaleDateString('fr-FR')} au ${new Date(historyEndDate).toLocaleDateString('fr-FR')}` : undefined}
                             />
                        </div>
                    </div>
                    <div className="flex gap-4 w-full justify-end">
                        <button onClick={() => setIsPrintListModalOpen(false)} className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-bold uppercase">Fermer</button>
                        <button onClick={handlePrintList} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase shadow-lg flex items-center"><PrintIcon className="w-5 h-5 mr-2" /> Imprimer</button>
                    </div>
                </div>
            </Modal>

            {/* WhatsApp Share Modal */}
            <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="PARTAGER VIA WHATSAPP" maxWidth="max-w-md">
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Numéro WhatsApp du client
                        </label>
                        <input
                            type="tel"
                            value={sharePhoneNumber}
                            onChange={(e) => setSharePhoneNumber(e.target.value)}
                            placeholder="+229 XX XX XX XX"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Format: +229 XXXXXXXX ou 2299XXXXXXXX
                        </p>
                    </div>
                    <div className="flex gap-4 pt-6 border-t dark:border-gray-700">
                        <button
                            onClick={() => setShowShareModal(false)}
                            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleShareWhatsapp}
                            disabled={isSharing || !sharePhoneNumber}
                            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-black hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <WhatsappIcon className="w-5 h-5" />
                            {isSharing ? 'Partage en cours...' : 'Partager'}
                        </button>
                    </div>
                </div>
            </Modal>
        
            {/* Payment History Table */}
            <div className="mt-12 w-full">
                <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-4 gap-4 max-w-7xl mx-auto">
                    <h2 className="text-xl font-black uppercase text-gray-900 dark:text-white">
                        Historique des {activeTab === 'clients' ? 'Versements Clients' : 'Paiements Fournisseurs'}
                        {selectedPartner && <span className="text-primary-600"> - {selectedPartner.name}</span>}
                    </h2>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                         <div className="relative flex-grow md:flex-grow-0">
                            <input 
                                type="text" 
                                value={historySearch}
                                onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                                placeholder="Rechercher (Nom, Réf, Notes)..."
                                className="w-full md:w-64 pl-9 pr-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 text-sm"
                            />
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                        </div>
                        <input 
                            type="date" 
                            value={historyStartDate}
                            onChange={(e) => { setHistoryStartDate(e.target.value); setHistoryPage(1); }}
                            className="px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-sm"
                        />
                        <span className="text-gray-400">-</span>
                        <input 
                            type="date" 
                            value={historyEndDate}
                            onChange={(e) => { setHistoryEndDate(e.target.value); setHistoryPage(1); }}
                            className="px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-sm"
                        />
                        <button 
                            onClick={() => setIsPrintListModalOpen(true)}
                            className="p-2 bg-gray-900 text-white rounded-lg shadow-lg hover:bg-black transition-all"
                            title="Imprimer la liste"
                        >
                            <PrintIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border dark:border-gray-700 overflow-hidden w-full max-w-7xl mx-auto">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-900/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase text-gray-400 tracking-wider w-1/6">Date</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase text-gray-400 tracking-wider w-1/4">Partenaire</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase text-gray-400 tracking-wider w-1/6">Facture</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase text-gray-400 tracking-wider w-1/6">Mode</th>
                                    <th className="px-6 py-4 text-right text-xs font-black uppercase text-gray-400 tracking-wider w-1/6">Montant</th>
                                    <th className="px-6 py-4 text-right text-xs font-black uppercase text-gray-400 tracking-wider w-1/12">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {paginatedHistory.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm italic">
                                            Aucun historique trouvé pour cette période.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedHistory.map((payment) => (
                                        <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700 dark:text-gray-300">
                                                {new Date(payment.date).toLocaleDateString('fr-FR')}
                                                <span className="block text-[10px] text-gray-400 font-normal">{new Date(payment.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[200px]" title={payment.partnerName}>
                                                    {payment.partnerName || '...'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-xs font-bold text-gray-500 uppercase bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded inline-block">
                                                    {payment.invoiceRef || '...'}
                                                </div>
                                                {payment.notes && <div className="text-[10px] text-gray-400 italic truncate max-w-[150px] mt-1" title={payment.notes}>{payment.notes}</div>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">
                                                    {payment.method}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <span className="text-sm font-black text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-3 py-1 rounded-lg">
                                                    {formatCurrency(payment.amount)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex justify-end gap-2">
                                                    {activeTab === 'clients' && (
                                                        <button 
                                                            onClick={() => handleHistoryReprint(payment)}
                                                            className="text-gray-500 hover:text-gray-900 p-2 bg-gray-100 rounded-lg transition-colors hover:bg-gray-200"
                                                            title="Imprimer Reçu"
                                                        >
                                                            <PrintIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => handleEditClick(payment)}
                                                        className="text-blue-600 hover:text-blue-900 p-2 bg-blue-50 rounded-lg transition-colors hover:bg-blue-100"
                                                        title="Modifier"
                                                    >
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeletePayment(payment.id, activeTab === 'clients' ? payment.saleId : payment.purchaseId, payment.amount)}
                                                        className="text-red-600 hover:text-red-900 p-2 bg-red-50 rounded-lg transition-colors hover:bg-red-100"
                                                        title="Supprimer"
                                                    >
                                                        <DeleteIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot className="border-t-2 border-gray-200 dark:border-gray-700">
                                <tr className="bg-blue-50 dark:bg-blue-900/20 border-b dark:border-gray-700">
                                    <td colSpan={3} className="px-6 py-3 text-right text-xs font-black uppercase text-gray-500">Total Page</td>
                                    <td className="px-6 py-3 text-sm font-black text-primary-600">{formatCurrency(totalPageAmount)}</td>
                                    <td colSpan={2}></td>
                                </tr>
                                <tr className="bg-blue-100 dark:bg-blue-900/40">
                                    <td colSpan={3} className="px-6 py-3 text-right text-xs font-black uppercase text-primary-600">Total Global</td>
                                    <td className="px-6 py-3 text-sm font-black text-primary-600">{formatCurrency(totalGlobalAmount)}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    
                    {/* Pagination Controls */}
                    <Pagination 
                        currentPage={historyPage} 
                        totalPages={totalHistoryPages} 
                        onPageChange={setHistoryPage} 
                        totalItems={filteredHistory.length} 
                        itemsPerPage={HISTORY_ITEMS_PER_PAGE} 
                    />
                </div>
            </div>
        </div>
    );
};

export default PaymentsPage;
