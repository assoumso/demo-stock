import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, where, doc } from 'firebase/firestore';
import { Product, Sale, Purchase, WarehouseTransfer, StockAdjustment, CreditNote, SupplierCreditNote, AppSettings } from '../types';
import { DownloadIcon, PrintIcon, ArrowLeftIcon, TrendingUpIcon, TrendingDownIcon, DollarSignIcon, PackageIcon, DocumentTextIcon, SearchIcon } from '../constants';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useData } from '../context/DataContext';

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
    const { products, categories, brands, suppliers, warehouses, customers } = useData();
    
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    // Filters State
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
    const [warehouseSearch, setWarehouseSearch] = useState('');
    const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);

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
        estimatedProfit: 0
    });

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `Historique_Stock_${product?.name || 'Produit'}`
    });

    // 1. Get Product from Context or Listener
    useEffect(() => {
        if (id) {
            const unsub = onSnapshot(doc(db, "products", id), (doc) => {
                if (doc.exists()) {
                    const prodData = { id: doc.id, ...doc.data() } as Product;
                    setProduct(prodData);
                    setProductSearch(`${prodData.name} - ${prodData.sku}`);
                } else {
                    const found = products.find(p => p.id === id);
                    if (found) {
                        setProduct(found);
                        setProductSearch(`${found.name} - ${found.sku}`);
                    }
                }
            });
            return () => unsub();
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
        const unsub = onSnapshot(collection(db, "appSettings"), (snap) => {
            if (!snap.empty) setSettings({ id: snap.docs[0].id, ...snap.docs[0].data() } as AppSettings);
        });
        return () => unsub();
    }, []);

    // 3. Real-time Listeners for Movements
    useEffect(() => {
        if (!id) return;
        setLoading(true);
        // Increased limit to capture more history and better opening stock calculation
        const LIMIT = 2000;

        const qSales = query(collection(db, "sales"), orderBy("date", "desc"), limit(LIMIT));
        const unsubSales = onSnapshot(qSales, (snap) => setRawSales(snap.docs.map(d => ({id: d.id, ...d.data()} as Sale))));

        const qPurchases = query(collection(db, "purchases"), orderBy("date", "desc"), limit(LIMIT));
        const unsubPurchases = onSnapshot(qPurchases, (snap) => setRawPurchases(snap.docs.map(d => ({id: d.id, ...d.data()} as Purchase))));

        const qTransfers = query(collection(db, "warehouseTransfers"), orderBy("date", "desc"), limit(LIMIT));
        const unsubTransfers = onSnapshot(qTransfers, (snap) => setRawTransfers(snap.docs.map(d => ({id: d.id, ...d.data()} as WarehouseTransfer))));

        const qAdjustments = query(collection(db, "stockAdjustments"), where("productId", "==", id), orderBy("date", "desc"), limit(LIMIT));
        const unsubAdjustments = onSnapshot(qAdjustments, (snap) => setRawAdjustments(snap.docs.map(d => ({id: d.id, ...d.data()} as StockAdjustment))));

        const qCreditNotes = query(collection(db, "creditNotes"), orderBy("date", "desc"), limit(LIMIT));
        const unsubCreditNotes = onSnapshot(qCreditNotes, (snap) => setRawCreditNotes(snap.docs.map(d => ({id: d.id, ...d.data()} as CreditNote))));

        const qSupplierCreditNotes = query(collection(db, "supplierCreditNotes"), orderBy("date", "desc"), limit(LIMIT));
        const unsubSupplierCreditNotes = onSnapshot(qSupplierCreditNotes, (snap) => setRawSupplierCreditNotes(snap.docs.map(d => ({id: d.id, ...d.data()} as SupplierCreditNote))));

        const timer = setTimeout(() => setLoading(false), 1500);

        return () => {
            unsubSales(); unsubPurchases(); unsubTransfers(); unsubAdjustments(); unsubCreditNotes(); unsubSupplierCreditNotes();
            clearTimeout(timer);
        };
    }, [id]);

    // 4. Process Data & Calculate Stats
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

        // Sales
        rawSales.forEach(sale => {
            // Filter by Warehouse if selected
            if (selectedWarehouseId !== 'all' && sale.warehouseId !== selectedWarehouseId) return;

            const item = sale.items?.find(i => i.productId === id);
            if (item) {
                const customer = customers.find(c => c.id === sale.customerId);
                rawHistory.push({
                    type: 'Vente',
                    date: sale.date,
                    reference: sale.referenceNumber,
                    quantityChange: -item.quantity,
                    partner: customer ? customer.name : 'client de passage',
                    unitPrice: item.price,
                    totalPrice: item.subtotal
                });
                totalSold += item.quantity;
                totalRevenue += item.subtotal;
            }
        });

        // Purchases
        rawPurchases.forEach(purchase => {
            // Filter by Warehouse if selected
            if (selectedWarehouseId !== 'all' && purchase.warehouseId !== selectedWarehouseId) return;

            if (purchase.purchaseStatus === 'Reçu') {
                const item = purchase.items?.find(i => i.productId === id);
                if (item) {
                    const supplier = suppliers.find(s => s.id === purchase.supplierId);
                    rawHistory.push({
                        type: 'Achat',
                        date: purchase.date,
                        reference: purchase.referenceNumber,
                        quantityChange: item.quantity,
                        partner: supplier ? supplier.name : 'Fournisseur inconnu',
                        unitPrice: item.cost,
                        totalPrice: item.subtotal
                    });
                    totalPurchase += item.quantity;
                }
            }
        });

        // Transfers
        rawTransfers.forEach(transfer => {
            let qty = 0;
            if (transfer.items && Array.isArray(transfer.items)) {
                const item = transfer.items.find(i => i.productId === id);
                if (item) qty = item.quantity;
            } else if (transfer.productId === id) {
                qty = transfer.quantity || 0;
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
                        partner: '-',
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
                        partner: '-',
                        warehouseName: toName
                    });
                    transferIn += qty;
                }
            }
        });

        // Adjustments
        rawAdjustments.forEach(adj => {
             // Filter by Warehouse if selected
             if (selectedWarehouseId !== 'all' && adj.warehouseId !== selectedWarehouseId) return;

            const change = adj.type === 'addition' ? adj.quantity : -adj.quantity;
            const reason = adj.reason?.toLowerCase() || '';
            const isInitial = reason.includes('initial') || reason.includes('ouverture') || reason.includes('inventaire') || reason.includes('départ');
            
            rawHistory.push({
                type: isInitial ? 'Stock Initial' : 'Ajustement',
                date: adj.date,
                reference: 'AJUSTEMENT',
                quantityChange: change,
                partner: '-',
                warehouseName: warehouses.find(w => w.id === adj.warehouseId)?.name
            });
            
            if (isInitial) {
                totalInitialStock += change;
            } else {
                if (change > 0) {
                    adjustmentIn += change;
                } else {
                    adjustmentOut += Math.abs(change);
                }
            }
        });

        // Credit Notes (Returns)
        rawCreditNotes.forEach(cn => {
            // Filter by Warehouse if selected (assuming CN has warehouseId, if not, might need logic adjustment)
            // For now assuming sales logic covers most, but strictly CN usually returns to a warehouse
             if (selectedWarehouseId !== 'all' && cn.warehouseId !== selectedWarehouseId) return;

            const item = cn.items?.find(i => i.productId === id);
            if (item) {
                const customer = customers.find(c => c.id === cn.customerId);
                rawHistory.push({
                    type: 'Retour Vente',
                    date: cn.date,
                    reference: cn.referenceNumber,
                    quantityChange: item.quantity,
                    partner: customer ? customer.name : 'Client inconnu'
                });
                totalSellReturn += item.quantity;
            }
        });

        // Supplier Credit Notes (Returns)
        rawSupplierCreditNotes.forEach(scn => {
            // Filter by Warehouse if selected
             if (selectedWarehouseId !== 'all' && scn.warehouseId !== selectedWarehouseId) return;

            const item = scn.items?.find(i => i.productId === id);
            if (item) {
                const supplier = suppliers.find(s => s.id === scn.supplierId);
                rawHistory.push({
                    type: 'Retour Achat',
                    date: scn.date,
                    reference: scn.referenceNumber,
                    quantityChange: -item.quantity,
                    partner: supplier ? supplier.name : 'Fournisseur inconnu'
                });
                totalPurchaseReturn += item.quantity;
            }
        });

        // Sort and Calculate Running Balance
        const parseDate = (date: any): number => {
            if (!date) return 0;
            if (date && typeof date.toDate === 'function') return date.toDate().getTime();
            if (date && typeof date === 'object' && 'seconds' in date) return date.seconds * 1000;
            const d = new Date(date);
            return isNaN(d.getTime()) ? 0 : d.getTime();
        };

        rawHistory.sort((a, b) => parseDate(a.date) - parseDate(b.date));

        // Calculate Initial Stock based on Warehouse Selection
        let currentTotalStock = 0;
        if (selectedWarehouseId === 'all') {
             currentTotalStock = (product.stockLevels || []).reduce((sum, sl) => sum + sl.quantity, 0);
        } else {
             const sl = (product.stockLevels || []).find(sl => sl.warehouseId === selectedWarehouseId);
             currentTotalStock = sl ? sl.quantity : 0;
        }

        let running = currentTotalStock;
        
        // Calculate backwards
        const historyReversed = [...rawHistory].reverse();
        const historyWithBalance = historyReversed.map(item => {
            const itemBalance = running;
            running -= item.quantityChange;
            return { ...item, newQuantity: itemBalance };
        }); 
        
        // The last value of 'running' after the loop is the Stock BEFORE the first transaction found.
        // We can treat this as "Opening Stock" relative to the displayed period.
        const calculatedOpeningStock = running;

        if (calculatedOpeningStock !== 0) {
            // Add a row for the initial state before the fetched history
            const oldestDate = rawHistory.length > 0 ? rawHistory[0].date : new Date();
            
            historyWithBalance.push({
                type: 'Stock Initial',
                date: oldestDate,
                reference: 'SOLDE_ANT',
                quantityChange: calculatedOpeningStock,
                newQuantity: calculatedOpeningStock,
                partner: '-',
                warehouseName: 'Solde précédent'
            });
        }

        setHistory(historyWithBalance);

        // Profit Calculation
        const estimatedCostOfGoodsSold = totalSold * product.cost;
        const estimatedProfit = totalRevenue - estimatedCostOfGoodsSold;

        setStats({
            totalPurchase,
            openingStock: calculatedOpeningStock + totalInitialStock, 
            totalSellReturn,
            transferIn,
            totalSold,
            adjustmentIn,
            adjustmentOut,
            totalPurchaseReturn,
            transferOut,
            totalRevenue,
            estimatedProfit
        });

    }, [rawSales, rawPurchases, rawTransfers, rawAdjustments, rawCreditNotes, rawSupplierCreditNotes, product, id, warehouses, selectedWarehouseId]);

    const parseDate = (date: any): number => {
        if (!date) return 0;
        try {
            if (date && typeof date.toDate === 'function') return date.toDate().getTime();
            if (date && typeof date === 'object' && 'seconds' in date) return date.seconds * 1000;
            const d = new Date(date);
            return isNaN(d.getTime()) ? 0 : d.getTime();
        } catch (e) { return 0; }
    };

    const handleExportCSV = () => {
        const ws = XLSX.utils.json_to_sheet(history.map(h => ({
            Type: h.type,
            'Fournisseur/Client': h.partner || '-',
            Date: new Date(parseDate(h.date)).toLocaleDateString('fr-FR'),
            Reference: h.reference,
            Changement: h.quantityChange,
            'Nouvelle Quantité': h.newQuantity,
            'Prix Unitaire': h.unitPrice || '-',
            'Total': h.totalPrice || '-'
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Historique");
        XLSX.writeFile(wb, `Historique_${product?.name}.csv`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(18);
        doc.text(`Historique Stock: ${product?.name}`, 14, 22);
        
        doc.setFontSize(11);
        doc.text(`SKU: ${product?.sku}`, 14, 30);
        doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 14, 36);

        // Stats Table
        const statsData = [
            ['Entrées', 'Sorties'],
            [`Stock Ouverture: ${stats.openingStock}`, `Ventes: ${stats.totalSold}`],
            [`Achats: ${stats.totalPurchase}`, `Retours Fourn.: ${stats.totalPurchaseReturn}`],
            [`Retours Clients: ${stats.totalSellReturn}`, `Transferts Sortants: ${stats.transferOut}`],
            [`Transferts Entrants: ${stats.transferIn}`, `Ajustements: ${stats.totalAdjustment}`]
        ];

        autoTable(doc, {
            startY: 45,
            head: [['Résumé Entrées', 'Résumé Sorties']],
            body: [
                [`Total Entrées: ${stats.totalPurchase + stats.totalSellReturn + stats.transferIn}`, `Total Sorties: ${stats.totalSold + stats.totalPurchaseReturn + stats.transferOut}`],
                ...statsData.slice(1).map(row => [row[0], row[1]]) // Simple mapping, could be better formatted
            ],
            theme: 'grid',
            headStyles: { fillColor: [66, 66, 66] }
        });

        // History Table
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['Type', 'Partenaire', 'Date', 'Réf.', 'Changement', 'Stock', 'Prix U.', 'Total']],
            body: history.map(h => [
                h.type,
                h.partner || '-',
                new Date(parseDate(h.date)).toLocaleDateString('fr-FR'),
                h.reference,
                h.quantityChange,
                h.newQuantity,
                h.unitPrice ? formatCurrency(h.unitPrice) : '-',
                h.totalPrice ? formatCurrency(h.totalPrice) : '-'
            ]),
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185] },
            styles: { fontSize: 8 }
        });

        doc.save(`Historique_${product?.name}.pdf`);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: settings?.currencySymbol || 'XOF' }).format(amount);
    };

    if (loading && !product) {
        return <div className="flex h-screen items-center justify-center text-gray-500 font-bold uppercase tracking-widest animate-pulse">Chargement...</div>;
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
                                {/* Overlay to close dropdown when clicking outside */}
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
                                            onClick={() => {
                                                setSelectedWarehouseId('all');
                                                setShowWarehouseDropdown(false);
                                            }}
                                            className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-50 dark:border-gray-700 ${selectedWarehouseId === 'all' ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                        >
                                            <div className="text-sm font-bold text-gray-900 dark:text-white">Tous les entrepôts</div>
                                            <div className="text-xs text-gray-500">Vue globale du stock</div>
                                        </div>
                                        {warehouses.map(w => (
                                            <div 
                                                key={w.id}
                                                onClick={() => {
                                                    setSelectedWarehouseId(w.id);
                                                    setShowWarehouseDropdown(false);
                                                }}
                                                className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-50 dark:border-gray-700 last:border-0 ${selectedWarehouseId === w.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                            >
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">{w.name}</div>
                                                <div className="text-xs text-gray-500">{w.location || 'Pas d\'adresse'}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {/* Overlay to close dropdown when clicking outside */}
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
                        {/* Quantités en */}
                        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-3xl border border-green-100 dark:border-green-800/30">
                            <h3 className="text-sm font-black text-green-800 dark:text-green-400 mb-4 uppercase tracking-wider flex items-center">
                                <TrendingUpIcon className="w-4 h-4 mr-2" />
                                Quantités en
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm border-b border-green-200 dark:border-green-800/50 pb-2">
                                    <span className="text-green-700 dark:text-green-300 font-bold">Total achat</span>
                                    <span className="font-black text-gray-900 dark:text-white">{stats.totalPurchase.toFixed(2)} {settings?.currencySymbol || ''}</span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-green-200 dark:border-green-800/50 pb-2">
                                    <span className="text-green-700 dark:text-green-300 font-bold">Stock d'ouverture</span>
                                    <span className="font-black text-gray-900 dark:text-white">{stats.openingStock.toFixed(2)} {settings?.currencySymbol || ''}</span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-green-200 dark:border-green-800/50 pb-2">
                                    <span className="text-green-700 dark:text-green-300 font-bold">Retour des ventes total</span>
                                    <span className="font-black text-gray-900 dark:text-white">{stats.totalSellReturn.toFixed(2)} {settings?.currencySymbol || ''}</span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-green-200 dark:border-green-800/50 pb-2">
                                    <span className="text-green-700 dark:text-green-300 font-bold">Transferts de stock (Dans)</span>
                                    <span className="font-black text-gray-900 dark:text-white">{stats.transferIn.toFixed(2)} {settings?.currencySymbol || ''}</span>
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
                                    <span className="font-black text-gray-900 dark:text-white">{stats.totalSold.toFixed(2)} {settings?.currencySymbol || ''}</span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-red-200 dark:border-red-800/50 pb-2">
                                    <span className="text-red-700 dark:text-red-300 font-bold">Total stock d'adjustment</span>
                                    <span className="font-black text-gray-900 dark:text-white">{stats.adjustmentOut.toFixed(2)} {settings?.currencySymbol || ''}</span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-red-200 dark:border-red-800/50 pb-2">
                                    <span className="text-red-700 dark:text-red-300 font-bold">Retour d'achat total</span>
                                    <span className="font-black text-gray-900 dark:text-white">{stats.totalPurchaseReturn.toFixed(2)} {settings?.currencySymbol || ''}</span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-red-200 dark:border-red-800/50 pb-2">
                                    <span className="text-red-700 dark:text-red-300 font-bold">Transferts de stock (En dehors)</span>
                                    <span className="font-black text-gray-900 dark:text-white">{stats.transferOut.toFixed(2)} {settings?.currencySymbol || ''}</span>
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
                                        {displayedCurrentStock.toFixed(2)} {settings?.currencySymbol || ''}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden mt-8">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-primary-600 text-white">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider">Changement</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider">Nouveau Stock</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider">Réf</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-wider">Info Partenaire</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {history.length === 0 ? (
                                        <tr><td colSpan={6} className="py-12 text-center text-gray-400 font-medium italic">Aucun historique de stock trouvé</td></tr>
                                    ) : (
                                        history.map((item, idx) => {
                                            const timestamp = parseDate(item.date);
                                            return (
                                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white text-xs uppercase">
                                                        {item.type}
                                                    </td>
                                                    <td className={`px-6 py-4 font-black text-xs ${item.quantityChange > 0 ? 'text-green-600' : item.quantityChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                                        {item.quantityChange > 0 ? '+' : ''}{item.quantityChange.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-gray-800 dark:text-gray-200 text-xs">
                                                        {item.newQuantity?.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500 text-xs font-medium">
                                                        {timestamp ? new Date(timestamp).toLocaleDateString('fr-FR') : '-'}
                                                        <span className="text-gray-400 ml-1 text-[10px]">{timestamp ? new Date(timestamp).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                                                    </td>
                                                    <td className="px-6 py-4 font-mono text-[10px] text-gray-500 bg-gray-50 dark:bg-gray-900 rounded inline-block my-2 mx-6">
                                                        {item.reference || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400 text-xs font-bold uppercase">
                                                        {item.partner || '-'}
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
