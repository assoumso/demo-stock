import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { Product, Sale, Purchase, WarehouseTransfer, StockAdjustment, CreditNote, SupplierCreditNote, AppSettings } from '../types';
import { DownloadIcon, PrintIcon, ArrowLeftIcon, TrendingUpIcon, TrendingDownIcon, PackageIcon, DocumentTextIcon, SearchIcon } from '../constants';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useData } from '../context/DataContext';

/**
 * Convertit une date Firestore (Timestamp ou string ISO) en objet Date JS valide.
 */
const parseFirestoreDate = (dateField: any): Date => {
    if (!dateField) return new Date(0);
    const d = new Date(dateField);
    return isNaN(d.getTime()) ? new Date(0) : d;
};

interface HistoryItem {
    type: 'Vente' | 'Achat' | 'Transfert (Entrant)' | 'Transfert (Sortant)' | 'Ajustement' | 'Retour Vente' | 'Retour Achat' | 'Stock Initial';
    date: any;
    reference: string;
    quantityChange: number;
    newQuantity?: number;
    partner?: string;
    warehouseName?: string;
    unitPrice?: number;
    totalPrice?: number;
}

const ProductHistoryPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { products, categories, brands, suppliers, warehouses, customers, units } = useData();
    
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    // Filters State
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
    const [warehouseSearch, setWarehouseSearch] = useState('');
    const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);

    const unitName = useMemo(() => {
        if (!product || !product.unitId) return '';
        return units.find(u => u.id === product.unitId)?.name || '';
    }, [product, units]);

    // Filtered Options
    const filteredProducts = useMemo(() => {
        if (!productSearch) return products.slice(0, 10);
        return products.filter(p => 
            p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
            p.sku.toLowerCase().includes(productSearch.toLowerCase())
        ).slice(0, 10);
    }, [products, productSearch]);

    const filteredWarehouses = useMemo(() => {
        if (!warehouseSearch) return warehouses;
        return warehouses.filter(w => w.name.toLowerCase().includes(warehouseSearch.toLowerCase()));
    }, [warehouses, warehouseSearch]);

    const displayedCurrentStock = useMemo(() => {
        if (!product) return 0;
        if (selectedWarehouseId === 'all') {
            return (product.stockLevels || []).reduce((sum, sl) => sum + sl.quantity, 0);
        }
        return (product.stockLevels || []).find(sl => sl.warehouseId === selectedWarehouseId)?.quantity || 0;
    }, [product, selectedWarehouseId]);

    // Raw Data States
    const [rawSales, setRawSales] = useState<Sale[]>([]);
    const [rawPurchases, setRawPurchases] = useState<Purchase[]>([]);
    const [rawTransfers, setRawTransfers] = useState<WarehouseTransfer[]>([]);
    const [rawAdjustments, setRawAdjustments] = useState<StockAdjustment[]>([]);
    const [rawCreditNotes, setRawCreditNotes] = useState<CreditNote[]>([]);
    const [rawSupplierCreditNotes, setRawSupplierCreditNotes] = useState<SupplierCreditNote[]>([]);

    const [stats, setStats] = useState({
        totalPurchase: 0,
        openingStock: 0,
        totalSellReturn: 0,
        transferIn: 0,
        totalSold: 0,
        adjustmentIn: 0,
        adjustmentOut: 0,
        totalPurchaseReturn: 0,
        transferOut: 0,
        totalRevenue: 0,
        estimatedProfit: 0,
        netSoldQuantity: 0,
        totalPhysicalIncoming: 0,
        totalPhysicalOutgoing: 0
    });

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Historique_Stock_${product?.name || 'Produit'}`
    });

    // 1. Get Product from Context or Supabase
    useEffect(() => {
        if (id) {
            const fetchProduct = async () => {
                // Try context first
                const found = products.find(p => p.id === id);
                if (found) {
                    setProduct(found);
                    setProductSearch(`${found.name} - ${found.sku}`);
                    return;
                }
                // Fallback to Supabase
                try {
                    const { data, error } = await supabase
                        .from('products')
                        .select('*')
                        .eq('id', id)
                        .single();
                    if (data && !error) {
                        setProduct(data as Product);
                        setProductSearch(`${data.name} - ${data.sku}`);
                    }
                } catch (e) {
                    console.error("Error fetching product:", e);
                }
            };
            fetchProduct();
        }
    }, [id, products]);

    // Update Product Selection
    const handleProductSelect = (p: Product) => {
        setProduct(p);
        setProductSearch(`${p.name} - ${p.sku}`);
        setShowProductDropdown(false);
        navigate(`/products/history/${p.id}`);
    };

    // 2. Fetch App Settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data, error } = await supabase
                    .from('app_settings')
                    .select('*')
                    .eq('id', 'app-config')
                    .single();
                if (data && !error) setSettings(data as AppSettings);
            } catch (e) {
                console.error("Error fetching settings:", e);
            }
        };
        fetchSettings();
    }, []);

    // 3. Fetch All Movements from Supabase
    useEffect(() => {
        if (!id) return;
        setLoading(true);
        setFetchError(null);
        
        const fetchData = async () => {
            const errors: string[] = [];
            try {
                // Parallel fetch of all collections
                const [salesRes, purchasesRes, transfersRes, adjustmentsRes, cnRes, scnRes] = await Promise.all([
                    supabase.from('sales').select('*'),
                    supabase.from('purchases').select('*'),
                    supabase.from('warehouse_transfers').select('*'),
                    supabase.from('stock_adjustments').select('*').eq('productId', id),
                    supabase.from('credit_notes').select('*'),
                    supabase.from('supplier_credit_notes').select('*')
                ]);

                if (salesRes.error) errors.push(`Ventes: ${salesRes.error.message}`);
                if (purchasesRes.error) errors.push(`Achats: ${purchasesRes.error.message}`);
                if (transfersRes.error) errors.push(`Transferts: ${transfersRes.error.message}`);
                if (adjustmentsRes.error) errors.push(`Ajustements: ${adjustmentsRes.error.message}`);
                if (cnRes.error) errors.push(`Avoirs clients: ${cnRes.error.message}`);
                if (scnRes.error) errors.push(`Avoirs fournisseurs: ${scnRes.error.message}`);

                if (errors.length > 0) {
                    setFetchError(`Erreurs lors du chargement: ${errors.join(', ')}`);
                }

                setRawSales((salesRes.data || []) as Sale[]);
                setRawPurchases((purchasesRes.data || []) as Purchase[]);
                setRawTransfers((transfersRes.data || []) as WarehouseTransfer[]);
                setRawAdjustments((adjustmentsRes.data || []) as StockAdjustment[]);
                setRawCreditNotes((cnRes.data || []) as CreditNote[]);
                setRawSupplierCreditNotes((scnRes.data || []) as SupplierCreditNote[]);

            } catch (error: any) {
                console.error("Error fetching history:", error);
                setFetchError(`Erreur générale: ${error.message}`);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    // 4. Process Data & Calculate Stats (runs after raw data is set)
    useEffect(() => {
        if (!product || !id) return;

        let totalPurchase = 0;
        let totalSold = 0;
        let totalSellReturn = 0;
        let totalPurchaseReturn = 0;
        let transferIn = 0;
        let transferOut = 0;
        let adjustmentIn = 0;
        let adjustmentOut = 0;
        let totalInitialStock = 0;
        let totalRevenue = 0;

        const rawHistory: HistoryItem[] = [];

        // Helper: find matching items in a list
        const findItems = (items: any[]): any[] => {
            if (!Array.isArray(items)) return [];
            return items.filter((i: any) => {
                if (!i) return false;
                const pid = i.productId || i.product_id || (i.product && i.product.id) || i.id;
                return pid === id;
            });
        };

        // --- SALES ---
        rawSales.forEach(sale => {
            if (selectedWarehouseId !== 'all' && sale.warehouseId && sale.warehouseId !== selectedWarehouseId) return;

            const items = findItems(Array.isArray(sale.items) ? sale.items : []);
            
            items.forEach(item => {
                const customer = customers.find(c => c.id === sale.customerId);
                const qty = Number(item.quantity) || 0;
                if (qty === 0) return;
                rawHistory.push({
                    type: 'Vente',
                    date: sale.date,
                    reference: sale.referenceNumber || sale.id,
                    quantityChange: -qty,
                    partner: customer
                        ? customer.name
                        : (sale.customerId === 'passage' ? 'Client de passage' : 'Client inconnu'),
                    warehouseName: warehouses.find(w => w.id === sale.warehouseId)?.name,
                    unitPrice: Number(item.price) || 0,
                    totalPrice: Number(item.subtotal) || 0
                });
                totalSold += qty;
                totalRevenue += (Number(item.subtotal) || 0);
            });
        });

        // --- PURCHASES ---
        rawPurchases.forEach(purchase => {
            if (selectedWarehouseId !== 'all' && purchase.warehouseId && purchase.warehouseId !== selectedWarehouseId) return;

            // Include all received purchases, or those without status (legacy)
            if (purchase.purchaseStatus === 'Reçu' || !purchase.purchaseStatus) {
                const items = findItems(Array.isArray(purchase.items) ? purchase.items : []);
                
                items.forEach(item => {
                    const supplier = suppliers.find(s => s.id === purchase.supplierId);
                    const qty = Number(item.quantity) || 0;
                    if (qty === 0) return;
                    const itemCost = Number((item as any).cost ?? (item as any).price) || 0;
                    rawHistory.push({
                        type: 'Achat',
                        date: purchase.date,
                        reference: purchase.referenceNumber || purchase.id,
                        quantityChange: qty,
                        partner: supplier ? supplier.name : 'Fournisseur inconnu',
                        warehouseName: warehouses.find(w => w.id === purchase.warehouseId)?.name,
                        unitPrice: itemCost,
                        totalPrice: qty * itemCost
                    });
                    totalPurchase += qty;
                });
            }
        });

        // --- TRANSFERS ---
        rawTransfers.forEach(transfer => {
            let qty = 0;
            if (transfer.items && Array.isArray(transfer.items)) {
                const items = findItems(transfer.items);
                items.forEach(trItem => {
                    qty += Number(trItem.quantity) || 0;
                });
            } else if (transfer.productId === id) {
                qty = Number(transfer.quantity) || 0;
            }

            if (qty > 0) {
                const fromName = warehouses.find(w => w.id === transfer.fromWarehouseId)?.name || 'Entrepôt Source';
                const toName = warehouses.find(w => w.id === transfer.toWarehouseId)?.name || 'Entrepôt Dest.';
                
                // Outgoing Transfer
                if (selectedWarehouseId === 'all' || selectedWarehouseId === transfer.fromWarehouseId) {
                    rawHistory.push({
                        type: 'Transfert (Sortant)',
                        date: transfer.date,
                        reference: transfer.id,
                        quantityChange: -qty,
                        partner: `→ ${toName}`,
                        warehouseName: fromName
                    });
                    transferOut += qty;
                }

                // Incoming Transfer
                if (selectedWarehouseId === 'all' || selectedWarehouseId === transfer.toWarehouseId) {
                    rawHistory.push({
                        type: 'Transfert (Entrant)',
                        date: transfer.date,
                        reference: transfer.id,
                        quantityChange: qty,
                        partner: `← ${fromName}`,
                        warehouseName: toName
                    });
                    transferIn += qty;
                }
            }
        });

        // --- ADJUSTMENTS ---
        rawAdjustments.forEach(adj => {
            if (selectedWarehouseId !== 'all' && adj.warehouseId !== selectedWarehouseId) return;

            const change = adj.type === 'addition' ? Number(adj.quantity) : -Number(adj.quantity);
            const reason = (adj.reason || '').toLowerCase();
            const isInitial = reason.includes('initial') || reason.includes('ouverture') || reason.includes('inventaire') || reason.includes('départ') || reason.includes('report') || reason.includes('solde');
            
            rawHistory.push({
                type: isInitial ? 'Stock Initial' : 'Ajustement',
                date: adj.date,
                reference: isInitial ? 'STOCK_INITIAL' : `AJUST-${adj.id.slice(0, 6).toUpperCase()}`,
                quantityChange: change,
                partner: adj.reason || '-',
                warehouseName: warehouses.find(w => w.id === adj.warehouseId)?.name
            });
            
            if (isInitial) {
                totalInitialStock += change;
            } else {
                if (change > 0) adjustmentIn += change;
                else adjustmentOut += Math.abs(change);
            }
        });

        // --- CREDIT NOTES (Retours Clients) ---
        rawCreditNotes.forEach(cn => {
            if (selectedWarehouseId !== 'all' && cn.warehouseId && cn.warehouseId !== selectedWarehouseId) return;

            const items = findItems(Array.isArray(cn.items) ? cn.items : []);
            
            items.forEach(item => {
                const customer = customers.find(c => c.id === cn.customerId);
                const qty = Number(item.quantity) || 0;
                if (qty === 0) return;
                rawHistory.push({
                    type: 'Retour Vente',
                    date: cn.date,
                    reference: cn.referenceNumber || cn.id,
                    quantityChange: qty,
                    partner: customer ? customer.name : 'Client inconnu',
                    unitPrice: Number((item as any).price || (item as any).cost) || 0,
                    totalPrice: Number(item.subtotal) || 0
                });
                totalSellReturn += qty;
            });
        });

        // --- SUPPLIER CREDIT NOTES (Retours Fournisseurs) ---
        rawSupplierCreditNotes.forEach(scn => {
            if (selectedWarehouseId !== 'all' && scn.warehouseId && scn.warehouseId !== selectedWarehouseId) return;

            const items = findItems(Array.isArray(scn.items) ? scn.items : []);

            items.forEach(item => {
                const supplier = suppliers.find(s => s.id === scn.supplierId);
                const qty = Number(item.quantity) || 0;
                if (qty === 0) return;
                rawHistory.push({
                    type: 'Retour Achat',
                    date: scn.date,
                    reference: scn.referenceNumber || scn.id,
                    quantityChange: -qty,
                    partner: supplier ? supplier.name : 'Fournisseur inconnu',
                    unitPrice: Number((item as any).price || (item as any).cost) || 0,
                    totalPrice: Number(item.subtotal) || 0
                });
                totalPurchaseReturn += qty;
            });
        });

        // --- Sort chronologically (oldest first) for running balance calculation ---
        rawHistory.sort((a, b) => parseFirestoreDate(a.date).getTime() - parseFirestoreDate(b.date).getTime());

        // --- Calculate Running Balance backwards (start from current stock) ---
        const currentTotalStock = selectedWarehouseId === 'all'
            ? (product.stockLevels || []).reduce((sum, sl) => sum + sl.quantity, 0)
            : ((product.stockLevels || []).find(sl => sl.warehouseId === selectedWarehouseId)?.quantity || 0);

        let running = currentTotalStock;
        
        // Work backwards: newest → oldest
        const historyReversed = [...rawHistory].reverse();
        const historyWithBalance = historyReversed.map(item => {
            // newQuantity = the balance AT the time of this operation (after it occurred)
            const itemBalance = running;
            running = Number((running - item.quantityChange).toFixed(4));
            return { ...item, newQuantity: itemBalance };
        });
        
        // 'running' now holds the stock value BEFORE the oldest transaction (opening stock)
        const calculatedOpeningStock = running;

        // Add opening stock row at the END of the reversed array (it will appear at the bottom of the table)
        if (calculatedOpeningStock !== 0 && rawHistory.length > 0) {
            const oldestDate = parseFirestoreDate(rawHistory[0].date);
            const initialDate = new Date(oldestDate.getTime() - 1000);
            
            historyWithBalance.push({
                type: 'Stock Initial',
                date: initialDate.toISOString(),
                reference: 'SOLDE_ANT',
                quantityChange: calculatedOpeningStock,
                newQuantity: calculatedOpeningStock,
                partner: 'Solde antérieur',
                warehouseName: 'Solde précédent'
            });
        }

        setHistory(historyWithBalance);

        // --- Stats Calculation ---
        let totalRevenueNet = 0;
        rawSales.forEach(sale => {
            if (selectedWarehouseId !== 'all' && sale.warehouseId !== selectedWarehouseId) return;
            const items = findItems(Array.isArray(sale.items) ? sale.items : []);
            items.forEach(item => {
                totalRevenueNet += Number(item.subtotal) || 0;
            });
        });
        rawCreditNotes.forEach(cn => {
            if (selectedWarehouseId !== 'all' && cn.warehouseId && cn.warehouseId !== selectedWarehouseId) return;
            const items = findItems(Array.isArray(cn.items) ? cn.items : []);
            items.forEach(item => {
                totalRevenueNet -= Number(item.subtotal) || 0;
            });
        });

        const netSoldQuantity = totalSold - totalSellReturn;
        const estimatedProfit = totalRevenueNet - (netSoldQuantity * (product.cost || 0));
        const openingStockTotal = calculatedOpeningStock + totalInitialStock;
        const totalPhysicalIncoming = totalPurchase + openingStockTotal + totalSellReturn + transferIn + adjustmentIn;
        const totalPhysicalOutgoing = totalSold + adjustmentOut + totalPurchaseReturn + transferOut;

        setStats({
            totalPurchase,
            openingStock: openingStockTotal,
            totalSellReturn,
            transferIn,
            totalSold,
            adjustmentIn,
            adjustmentOut,
            totalPurchaseReturn,
            transferOut,
            totalRevenue: totalRevenueNet,
            estimatedProfit,
            netSoldQuantity,
            totalPhysicalIncoming,
            totalPhysicalOutgoing
        });

    }, [rawSales, rawPurchases, rawTransfers, rawAdjustments, rawCreditNotes, rawSupplierCreditNotes,
        product, id, warehouses, selectedWarehouseId, customers, suppliers]);

    const handleExportCSV = () => {
        const ws = XLSX.utils.json_to_sheet(history.map(h => ({
            Type: h.type,
            'Fournisseur/Client': h.partner || '-',
            Entrepôt: h.warehouseName || '-',
            Date: parseFirestoreDate(h.date).toLocaleDateString('fr-FR'),
            Heure: parseFirestoreDate(h.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            Reference: h.reference,
            Changement: h.quantityChange,
            'Nouveau Stock': h.newQuantity,
            'Prix Unitaire': h.unitPrice || '-',
            'Total': h.totalPrice || '-'
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Historique");
        XLSX.writeFile(wb, `Historique_${product?.name}.csv`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text(`Historique Stock: ${product?.name}`, 14, 22);
        
        doc.setFontSize(11);
        doc.text(`SKU: ${product?.sku}`, 14, 30);
        doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 14, 36);

        autoTable(doc, {
            startY: 45,
            head: [['Résumé Entrées', 'Résumé Sorties']],
            body: [
                [`Total Achats: ${stats.totalPurchase}`, `Total Ventes: ${stats.totalSold}`],
                [`Stock Ouverture: ${stats.openingStock}`, `Retours Fourn.: ${stats.totalPurchaseReturn}`],
                [`Retours Clients: ${stats.totalSellReturn}`, `Transferts Sortants: ${stats.transferOut}`],
                [`Transferts Entrants: ${stats.transferIn}`, `Ajustements (-): ${stats.adjustmentOut}`],
                [`Ajustements (+): ${stats.adjustmentIn}`, `Stock Actuel: ${displayedCurrentStock}`],
            ],
            theme: 'grid',
            headStyles: { fillColor: [66, 66, 66] }
        });

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['Type', 'Partenaire', 'Date', 'Réf.', 'Chgt', 'Stock', 'Prix U.', 'Total']],
            body: history.map(h => {
                const d = parseFirestoreDate(h.date);
                return [
                    h.type,
                    h.partner || '-',
                    `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
                    h.reference,
                    h.quantityChange > 0 ? `+${h.quantityChange.toFixed(2)}` : h.quantityChange.toFixed(2),
                    h.newQuantity?.toFixed(2) ?? '-',
                    h.unitPrice ? formatCurrency(h.unitPrice) : '-',
                    h.totalPrice ? formatCurrency(h.totalPrice) : '-'
                ];
            }),
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185] },
            styles: { fontSize: 8 }
        });

        doc.save(`Historique_${product?.name}.pdf`);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: settings?.currencySymbol || 'XOF' }).format(amount);
    };

    // Type badge styling
    const getTypeBadge = (type: HistoryItem['type']) => {
        switch (type) {
            case 'Vente':               return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
            case 'Achat':               return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
            case 'Transfert (Entrant)': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
            case 'Transfert (Sortant)': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
            case 'Ajustement':          return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
            case 'Retour Vente':        return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300';
            case 'Retour Achat':        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
            case 'Stock Initial':       return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
            default:                    return 'bg-gray-100 text-gray-600';
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center flex-col gap-3">
                <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-500 font-bold uppercase tracking-widest text-xs animate-pulse">Chargement des mouvements...</span>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="p-6 max-w-7xl mx-auto text-center">
                <button onClick={() => navigate('/products')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 font-bold uppercase text-xs tracking-widest mx-auto">
                    <ArrowLeftIcon className="w-5 h-5 mr-2" /> Retour
                </button>
                <div className="p-8 bg-red-50 text-red-600 rounded-3xl font-bold">Produit introuvable</div>
            </div>
        );
    }

    return (
        <div className="pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Historique du stock produit</h1>
                    <p className="text-gray-500 text-sm">Consultez les mouvements de stock détaillés.</p>
                </div>
                <button onClick={() => navigate('/products')} className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors font-bold uppercase text-xs shadow-lg">
                    <ArrowLeftIcon className="w-5 h-5 mr-2" />
                    Retour
                </button>
            </div>

            {/* Error Banner */}
            {fetchError && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-700 dark:text-red-300 text-sm font-medium">
                    ⚠️ {fetchError}
                </div>
            )}

            <div ref={printRef} className="space-y-6">
                {/* Top Card: Selection/Info */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Produit:</label>
                            <div className="relative">
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        value={productSearch}
                                        onChange={(e) => {
                                            setProductSearch(e.target.value);
                                            setShowProductDropdown(true);
                                        }}
                                        onFocus={() => setShowProductDropdown(true)}
                                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl border-none focus:ring-2 focus:ring-primary-500 font-bold text-sm"
                                        placeholder="Rechercher un produit..."
                                    />
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIcon className="w-4 h-4"/></div>
                                </div>
                                {showProductDropdown && (
                                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 max-h-60 overflow-auto">
                                        {filteredProducts.map(p => (
                                            <div 
                                                key={p.id}
                                                onClick={() => handleProductSelect(p)}
                                                className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-50 dark:border-gray-700 last:border-0"
                                            >
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">{p.name}</div>
                                                <div className="text-xs text-gray-500 font-mono">{p.sku}</div>
                                            </div>
                                        ))}
                                        {filteredProducts.length === 0 && (
                                            <div className="px-4 py-3 text-sm text-gray-500 italic">Aucun produit trouvé</div>
                                        )}
                                    </div>
                                )}
                                {showProductDropdown && (
                                    <div className="fixed inset-0 z-0" onClick={() => setShowProductDropdown(false)}></div>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Entrepôts:</label>
                            <div className="relative">
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        value={selectedWarehouseId === 'all' ? 'Tous les entrepôts' : warehouses.find(w => w.id === selectedWarehouseId)?.name || ''}
                                        readOnly
                                        onClick={() => setShowWarehouseDropdown(!showWarehouseDropdown)}
                                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl border-none focus:ring-2 focus:ring-primary-500 font-bold text-sm cursor-pointer"
                                    />
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><PackageIcon className="w-4 h-4"/></div>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                    </div>
                                </div>
                                {showWarehouseDropdown && (
                                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 max-h-60 overflow-auto">
                                        <div 
                                            onClick={() => { setSelectedWarehouseId('all'); setShowWarehouseDropdown(false); }}
                                            className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-50 dark:border-gray-700 ${selectedWarehouseId === 'all' ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                        >
                                            <div className="text-sm font-bold text-gray-900 dark:text-white">Tous les entrepôts</div>
                                            <div className="text-xs text-gray-500">Vue globale du stock</div>
                                        </div>
                                        {warehouses.map(w => (
                                            <div 
                                                key={w.id}
                                                onClick={() => { setSelectedWarehouseId(w.id); setShowWarehouseDropdown(false); }}
                                                className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-50 dark:border-gray-700 last:border-0 ${selectedWarehouseId === w.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                            >
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">{w.name}</div>
                                                <div className="text-xs text-gray-500">{w.location || 'Pas d\'adresse'}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {showWarehouseDropdown && (
                                    <div className="fixed inset-0 z-0" onClick={() => setShowWarehouseDropdown(false)}></div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Middle Card: Stats */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-black text-gray-900 dark:text-white mb-6 uppercase tracking-tight">{product.name} ({product.sku})</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* Quantités entrantes */}
                        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-3xl border border-green-100 dark:border-green-800/30">
                            <h3 className="text-sm font-black text-green-800 dark:text-green-400 mb-4 uppercase tracking-wider flex items-center">
                                <TrendingUpIcon className="w-4 h-4 mr-2" />
                                Quantités entrantes
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm border-b border-green-200 dark:border-green-800/50 pb-2">
                                    <span className="text-green-700 dark:text-green-300 font-bold">Total achat</span>
                                    <span className="font-black text-gray-900 dark:text-white">{stats.totalPurchase.toFixed(2)} {unitName}</span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-green-200 dark:border-green-800/50 pb-2">
                                    <span className="text-green-700 dark:text-green-300 font-bold">Stock d'ouverture</span>
                                    <span className="font-black text-gray-900 dark:text-white">{stats.openingStock.toFixed(2)} {unitName}</span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-green-200 dark:border-green-800/50 pb-2">
                                    <span className="text-green-700 dark:text-green-300 font-bold">Retour des ventes</span>
                                    <span className="font-black text-gray-900 dark:text-white">{stats.totalSellReturn.toFixed(2)} {unitName}</span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-green-200 dark:border-green-800/50 pb-2">
                                    <span className="text-green-700 dark:text-green-300 font-bold">Transferts entrants</span>
                                    <span className="font-black text-gray-900 dark:text-white">{stats.transferIn.toFixed(2)} {unitName}</span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-green-200 dark:border-green-800/50 pb-2">
                                    <span className="text-green-700 dark:text-green-300 font-bold">Ajustements (+)</span>
                                    <span className="font-black text-gray-900 dark:text-white">{stats.adjustmentIn.toFixed(2)} {unitName}</span>
                                </div>
                                <div className="flex justify-between text-sm pt-2 bg-green-100/50 dark:bg-green-900/40 px-2 rounded-lg mt-1 font-black">
                                    <span className="text-green-800 dark:text-green-200 uppercase text-[10px]">Total Entrées</span>
                                    <span className="text-green-900 dark:text-white">{stats.totalPhysicalIncoming.toFixed(2)} {unitName}</span>
                                </div>
                            </div>
                        </div>

                        {/* Quantités sortantes */}
                        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-3xl border border-red-100 dark:border-red-800/30">
                            <h3 className="text-sm font-black text-red-800 dark:text-red-400 mb-4 uppercase tracking-wider flex items-center">
                                <TrendingDownIcon className="w-4 h-4 mr-2" />
                                Quantités sortantes
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm border-b border-red-200 dark:border-red-800/50 pb-2">
                                    <span className="text-red-700 dark:text-red-300 font-bold">Total vendu</span>
                                    <span className="font-black text-gray-900 dark:text-white">{stats.totalSold.toFixed(2)} {unitName}</span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-red-200 dark:border-red-800/50 pb-2">
                                    <span className="text-red-700 dark:text-red-300 font-bold">Ajustements (-)</span>
                                    <span className="font-black text-gray-900 dark:text-white">{stats.adjustmentOut.toFixed(2)} {unitName}</span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-red-200 dark:border-red-800/50 pb-2">
                                    <span className="text-red-700 dark:text-red-300 font-bold">Retour d'achat</span>
                                    <span className="font-black text-gray-900 dark:text-white">{stats.totalPurchaseReturn.toFixed(2)} {unitName}</span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-red-200 dark:border-red-800/50 pb-2">
                                    <span className="text-red-700 dark:text-red-300 font-bold">Transferts sortants</span>
                                    <span className="font-black text-gray-900 dark:text-white">{stats.transferOut.toFixed(2)} {unitName}</span>
                                </div>
                                <div className="flex justify-between text-sm pt-2 bg-red-100/50 dark:bg-red-900/40 px-2 rounded-lg mt-1 font-black">
                                    <span className="text-red-800 dark:text-red-200 uppercase text-[10px]">Total Sorties</span>
                                    <span className="text-red-900 dark:text-white">{stats.totalPhysicalOutgoing.toFixed(2)} {unitName}</span>
                                </div>
                            </div>
                        </div>

                        {/* Totaux */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl border border-blue-100 dark:border-blue-800/30">
                            <h3 className="text-sm font-black text-blue-800 dark:text-blue-400 mb-4 uppercase tracking-wider flex items-center">
                                <PackageIcon className="w-4 h-4 mr-2" />
                                Totaux
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm border-b border-blue-200 dark:border-blue-800/50 pb-2">
                                    <span className="text-blue-700 dark:text-blue-300 font-black uppercase">Stock actuel</span>
                                    <span className="font-black text-gray-900 dark:text-white text-lg">
                                        {displayedCurrentStock.toFixed(2)} {unitName}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-blue-200 dark:border-blue-800/50 pb-2">
                                    <span className="text-blue-700 dark:text-gray-400 font-bold uppercase">Ventes Nettes (Qté)</span>
                                    <span className="font-black text-blue-900 dark:text-blue-200">
                                        {stats.netSoldQuantity.toFixed(2)} {unitName}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-blue-200 dark:border-blue-800/50 pb-2">
                                    <span className="text-blue-700 dark:text-gray-400 font-bold uppercase">Chiffre d'Affaires Net</span>
                                    <span className="font-black text-blue-800 dark:text-blue-300">
                                        {formatCurrency(stats.totalRevenue)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm pt-2">
                                    <span className="text-blue-700 dark:text-gray-400 font-bold uppercase">Bénéfice Estimé</span>
                                    <span className={`font-black ${stats.estimatedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(stats.estimatedProfit)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* History Table */}
                    <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden mt-8">
                        {/* Table Header info */}
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-widest text-gray-500">
                                {history.length} mouvement{history.length > 1 ? 's' : ''} trouvé{history.length > 1 ? 's' : ''}
                            </span>
                            <span className="text-xs text-gray-400 italic">Du plus récent au plus ancien</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-primary-600 text-white">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider">Changement</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider">Stock après</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider">Date & Heure</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider">Référence</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-wider">Partenaire / Info</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {history.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-16 text-center">
                                                <div className="flex flex-col items-center gap-3 text-gray-400">
                                                    <PackageIcon className="w-10 h-10 opacity-30" />
                                                    <span className="font-medium italic text-sm">Aucun mouvement de stock trouvé pour ce produit</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        history.map((item, idx) => {
                                            const d = parseFirestoreDate(item.date);
                                            return (
                                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                    <td className="px-6 py-3">
                                                        <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${getTypeBadge(item.type)}`}>
                                                            {item.type}
                                                        </span>
                                                    </td>
                                                    <td className={`px-6 py-3 font-black text-sm ${item.quantityChange > 0 ? 'text-green-600 dark:text-green-400' : item.quantityChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                                                        {item.quantityChange > 0 ? '+' : ''}{item.quantityChange.toFixed(2)}
                                                        <span className="text-[10px] ml-1 text-gray-400 font-normal">{unitName}</span>
                                                    </td>
                                                    <td className="px-6 py-3 font-black text-gray-800 dark:text-gray-200 text-sm">
                                                        {item.newQuantity?.toFixed(2) ?? '-'}
                                                        <span className="text-[10px] ml-1 text-gray-400 font-normal">{unitName}</span>
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-500 text-xs">
                                                        <div className="font-semibold">{d.toLocaleDateString('fr-FR')}</div>
                                                        <div className="text-gray-400">{d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <span className="font-mono text-[10px] text-gray-500 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded">
                                                            {item.reference || '-'}
                                                        </span>
                                                        {item.unitPrice ? (
                                                            <div className="text-[9px] text-gray-400 mt-1">
                                                                PU: {formatCurrency(item.unitPrice)}
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <div className="text-gray-700 dark:text-gray-300 text-xs font-bold">{item.partner || '-'}</div>
                                                        {item.warehouseName && (
                                                            <div className="text-[10px] text-gray-400 mt-0.5">{item.warehouseName}</div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="flex flex-wrap gap-4 pt-4">
                    <button onClick={handleExportCSV} className="flex items-center px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 text-xs font-black uppercase hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:scale-105">
                        <DownloadIcon className="w-4 h-4 mr-2" /> Exporter CSV
                    </button>
                    <button onClick={handleExportPDF} className="flex items-center px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 text-xs font-black uppercase hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:scale-105">
                        <DocumentTextIcon className="w-4 h-4 mr-2" /> Exporter PDF
                    </button>
                    <button onClick={handlePrint} className="flex items-center px-6 py-3 bg-gray-900 text-white rounded-xl shadow-lg text-xs font-black uppercase hover:bg-black transition-all hover:scale-105">
                        <PrintIcon className="w-4 h-4 mr-2" /> Imprimer
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductHistoryPage;
