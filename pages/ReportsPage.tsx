import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Sale, Product, Warehouse, Customer, SalePayment } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useReactToPrint } from 'react-to-print';
import { ShoppingCartIcon, TrendingUpIcon, WarningIcon, ChartBarIcon, SparklesIcon, DownloadIcon, CashIcon, PrintIcon } from '../constants';

type ReportType = 'sales' | 'profit' | 'stock_alert' | 'inventory_value' | 'services' | 'cash';

const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const ReportsPage: React.FC = () => {
    const { user, hasPermission } = useAuth();
    const [activeReport, setActiveReport] = useState<ReportType>('sales');
    
    const [sales, setSales] = useState<Sale[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [payments, setPayments] = useState<SalePayment[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [filters, setFilters] = useState({
        startDate: thirtyDaysAgo.toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        warehouseId: 'all',
    });
    
    const [cashFilters, setCashFilters] = useState({
        showDetailed: false,
        includeCredits: false, // If true, implies calculating 'Sales' revenue. If false, implies 'Payments' collected.
                               // Based on user prompt: "Inclusion ou exclusion des crédits dans le calcul".
                               // If "Credits included" -> Maybe it means "Sales made on credit" are counted as money? No, that's wrong for "Caisse".
                               // It likely means: "Show me total Revenue (Sales) vs Total Cash (Payments)".
                               // Let's implement it as: "Source de données": "Paiements (Encaissé)" vs "Ventes (Engagé)".
    });

    const cashReportData = useMemo(() => {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);

        // 1. Data Source: Payments (Money In)
        const relevantPayments = payments.filter(p => {
            const pDate = new Date(p.date);
            return pDate >= start && pDate <= end;
        });

        // 2. Data Source: Sales (Revenue Engaged)
        const relevantSales = sales.filter(s => {
            const sDate = new Date(s.date);
            return sDate >= start && sDate <= end;
        });

        const totalCashIn = relevantPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalSalesRevenue = relevantSales.reduce((sum, s) => sum + s.grandTotal, 0);
        const totalCreditSalesValue = relevantSales.filter(s => s.paymentStatus !== 'Payé').reduce((sum, s) => sum + (s.grandTotal - s.paidAmount), 0);

        // Calculate Cost of Goods Sold (COGS) for relevant sales to determine profit
        let totalCOGS = 0;
        relevantSales.forEach(sale => {
            if (sale.items && Array.isArray(sale.items)) {
                sale.items.forEach(item => {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        const cost = Number(product.cost) || 0;
                        const quantity = Number(item.quantity) || 0;
                        totalCOGS += cost * quantity;
                    }
                });
            }
        });
        
        const totalProfit = (Number(totalSalesRevenue) || 0) - totalCOGS;

        return {
            totalCashIn,
            totalSalesRevenue,
            totalCreditSalesValue,
            totalProfit,
            payments: relevantPayments,
            sales: relevantSales
        };
    }, [payments, sales, filters, products]);

    const cashReportRef = React.useRef(null);
    const handlePrintCashReport = useReactToPrint({
        contentRef: cashReportRef,
        documentTitle: `Rapport_Caisse_${filters.startDate}_${filters.endDate}`,
    });

    const isAdmin = useMemo(() => user?.role.name.toLowerCase().includes('admin'), [user]);

    useEffect(() => {
        const orderedReports: ReportType[] = [];
        if (isAdmin && hasPermission('reports:profit')) orderedReports.push('profit');
        if (hasPermission('reports:sales')) orderedReports.push('sales');
        if (hasPermission('reports:sales')) orderedReports.push('cash');
        if (hasPermission('reports:services')) orderedReports.push('services');
        if (isAdmin && hasPermission('reports:stock_alert')) orderedReports.push('stock_alert');
        if (hasPermission('reports:inventory_value')) orderedReports.push('inventory_value');

        if (orderedReports.length > 0 && !orderedReports.includes(activeReport)) {
            setActiveReport(orderedReports[0]);
        }
    }, [user, isAdmin, hasPermission, activeReport]);


    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [salesSnap, productsSnap, warehousesSnap, customersSnap, paymentsSnap] = await Promise.all([
                    getDocs(collection(db, 'sales')),
                    getDocs(collection(db, 'products')),
                    getDocs(collection(db, 'warehouses')),
                    getDocs(collection(db, 'customers')),
                    getDocs(collection(db, 'salePayments')),
                ]);
                setSales(salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
                setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
                setWarehouses(warehousesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
                setCustomers(customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
                setPayments(paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalePayment)));
            } catch (err) {
                console.error("Error fetching report data:", err);
                setError("Impossible de charger les données pour les rapports.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const userVisibleWarehouses = useMemo(() => {
        if (!user) return [];
        if (isAdmin) {
            return warehouses;
        }
        return warehouses.filter(wh => user.warehouseIds?.includes(wh.id));
    }, [user, warehouses, isAdmin]);
    
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const formatCurrency = (value: number) => new Intl.NumberFormat('fr-FR').format(value) + ' FCFA';
    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('fr-FR');

    const userVisibleSales = useMemo(() => {
        if (!user) return [];
        const visibleWarehouseIds = userVisibleWarehouses.map(wh => wh.id);
        return sales.filter(sale => visibleWarehouseIds.includes(sale.warehouseId));
    }, [user, sales, userVisibleWarehouses]);

    const filteredSales = useMemo(() => {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);

        return userVisibleSales.filter(sale => {
            const saleDate = new Date(sale.date);
            const warehouseMatch = filters.warehouseId === 'all' || sale.warehouseId === filters.warehouseId;
            return saleDate >= start && saleDate <= end && warehouseMatch;
        });
    }, [userVisibleSales, filters]);

    const salesReportData = useMemo(() => {
        const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.grandTotal, 0);
        const salesCount = filteredSales.length;
        const averageSaleValue = salesCount > 0 ? totalRevenue / salesCount : 0;
        return { totalRevenue, salesCount, averageSaleValue };
    }, [filteredSales]);

    const profitReportData = useMemo(() => {
        let totalRevenue = 0;
        let totalCogs = 0;
        const salesWithProfit = filteredSales.map(sale => {
            let saleCogs = 0;
            for (const item of sale.items) {
                const product = products.find(p => p.id === item.productId);
                saleCogs += (product?.cost || 0) * item.quantity;
            }
            const profit = sale.grandTotal - saleCogs;
            totalRevenue += sale.grandTotal;
            totalCogs += saleCogs;
            return { ...sale, cogs: saleCogs, profit };
        });
        const totalProfit = totalRevenue - totalCogs;
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
        return { totalRevenue, totalCogs, totalProfit, profitMargin, salesWithProfit };
    }, [filteredSales, products]);

    const stockAlertData = useMemo(() => {
        return products.filter(product => {
            if (product.type === 'service') return false; // Exclude services from stock alerts
            let currentStock: number;
            if (filters.warehouseId === 'all') {
                const visibleWarehouseIds = userVisibleWarehouses.map(wh => wh.id);
                currentStock = (product.stockLevels || [])
                    .filter(sl => visibleWarehouseIds.includes(sl.warehouseId))
                    .reduce((sum, sl) => sum + sl.quantity, 0);
            } else {
                currentStock = product.stockLevels?.find(sl => sl.warehouseId === filters.warehouseId)?.quantity || 0;
            }
            return currentStock <= product.minStockAlert;
        });
    }, [products, filters.warehouseId, userVisibleWarehouses]);
    
    const inventoryValueData = useMemo(() => {
        const warehousesToCalc = filters.warehouseId === 'all'
            ? userVisibleWarehouses
            : userVisibleWarehouses.filter(wh => wh.id === filters.warehouseId);

        const valueByWarehouse = warehousesToCalc.map(warehouse => {
            const warehouseValue = products
            .filter(p => p.type !== 'service') // Exclude services from inventory value calculation
            .reduce((sum, product) => {
                const stockLevel = product.stockLevels?.find(sl => sl.warehouseId === warehouse.id);
                const quantity = stockLevel?.quantity || 0;
                return sum + (product.cost * quantity);
            }, 0);
            return {
                warehouseId: warehouse.id,
                warehouseName: warehouse.name,
                totalValue: warehouseValue
            };
        });

        const totalValue = valueByWarehouse.reduce((sum, wh) => sum + wh.totalValue, 0);

        return { totalValue, valueByWarehouse };
    }, [products, userVisibleWarehouses, filters.warehouseId]);
    
    const servicesReportData = useMemo(() => {
        const servicesSold: { [key: string]: { name: string; quantity: number; revenue: number } } = {};

        filteredSales.forEach(sale => {
            sale.items.forEach(item => {
                const product = products.find(p => p.id === item.productId);
                if (product && product.type === 'service') {
                    if (servicesSold[product.id]) {
                        servicesSold[product.id].quantity += item.quantity;
                        servicesSold[product.id].revenue += item.subtotal;
                    } else {
                        servicesSold[product.id] = {
                            name: product.name,
                            quantity: item.quantity,
                            revenue: item.subtotal,
                        };
                    }
                }
            });
        });

        const servicesList = Object.values(servicesSold).sort((a, b) => b.revenue - a.revenue);
        const totalRevenue = servicesList.reduce((sum, s) => sum + s.revenue, 0);
        const totalQuantity = servicesList.reduce((sum, s) => sum + s.quantity, 0);

        const mostSoldService = servicesList.length > 0
            ? servicesList.reduce((prev, current) => (prev.quantity > current.quantity) ? prev : current)
            : null;

        return {
            servicesList,
            totalRevenue,
            totalQuantity,
            mostSoldService,
        };
    }, [filteredSales, products]);


    const getCustomerName = (customerId: string) => customers.find(c => c.id === customerId)?.name || 'N/A';
    
    const StatCard: React.FC<{ title: string, value: string | number, subtext?: string, valueClassName?: string }> = ({ title, value, subtext, valueClassName }) => (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h4>
            <p className={`text-2xl font-bold ${valueClassName || 'text-gray-900 dark:text-white'}`}>{value}</p>
            {subtext && <p className="text-xs text-gray-500 dark:text-gray-400">{subtext}</p>}
        </div>
    );
    
    const ReportTab: React.FC<{ reportType: ReportType, label: string, icon: React.ReactElement }> = ({ reportType, label, icon }) => (
        <button
            onClick={() => setActiveReport(reportType)}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 ${activeReport === reportType ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );

    return (
        <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Rapports</h1>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="text-sm">Date de début</label>
                        <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="w-full mt-1 border rounded p-2 dark:bg-gray-700"/>
                    </div>
                     <div>
                        <label className="text-sm">Date de fin</label>
                        <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="w-full mt-1 border rounded p-2 dark:bg-gray-700"/>
                    </div>
                     <div>
                        <label className="text-sm">Entrepôt</label>
                        <select name="warehouseId" value={filters.warehouseId} onChange={handleFilterChange} className="w-full mt-1 border rounded p-2 dark:bg-gray-700">
                            <option value="all">Tous les entrepôts</option>
                            {userVisibleWarehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    {isAdmin && hasPermission('reports:profit') && <ReportTab reportType="profit" label="Marge (P&L)" icon={<TrendingUpIcon className="w-5 h-5"/>}/>}
                    {hasPermission('reports:sales') && <ReportTab reportType="sales" label="Ventes" icon={<ShoppingCartIcon className="w-5 h-5"/>}/>}
                    {hasPermission('reports:sales') && <ReportTab reportType="cash" label="Caisse" icon={<CashIcon className="w-5 h-5"/>}/>}
                    {hasPermission('reports:services') && <ReportTab reportType="services" label="Services" icon={<SparklesIcon className="w-5 h-5"/>}/>}
                    {isAdmin && hasPermission('reports:stock_alert') && <ReportTab reportType="stock_alert" label="Alertes Stock" icon={<WarningIcon className="w-5 h-5"/>}/>}
                    {hasPermission('reports:inventory_value') && <ReportTab reportType="inventory_value" label="Valeur du Stock" icon={<ChartBarIcon className="w-5 h-5"/>}/>}
                </nav>
            </div>

            <div className="mt-6">
                {loading && <p>Chargement des données du rapport...</p>}
                {error && <p className="text-red-500">{error}</p>}
                {!loading && !error && (
                    <>
                        {activeReport === 'cash' && hasPermission('reports:sales') && (
                            <div>
                                <div className="mb-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Configuration du Rapport Caisse</h3>
                                            <p className="text-sm text-gray-500">Période: {new Date(filters.startDate).toLocaleDateString()} au {new Date(filters.endDate).toLocaleDateString()}</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <button 
                                                onClick={() => {
                                                    const today = new Date().toISOString().split('T')[0];
                                                    setFilters(prev => ({ ...prev, startDate: today, endDate: today }));
                                                }}
                                                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-200"
                                            >
                                                Aujourd'hui
                                            </button>
                                            <button 
                                                onClick={handlePrintCashReport}
                                                className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-black gap-2"
                                            >
                                                <PrintIcon className="w-4 h-4"/> Imprimer / PDF
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-6 border-t pt-4 dark:border-gray-700">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={cashFilters.includeCredits} 
                                                onChange={e => setCashFilters(prev => ({ ...prev, includeCredits: e.target.checked }))}
                                                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                                            />
                                            <span className="text-sm font-medium">Inclure les ventes à crédit (CA Théorique)</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={cashFilters.showDetailed} 
                                                onChange={e => setCashFilters(prev => ({ ...prev, showDetailed: e.target.checked }))}
                                                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                                            />
                                            <span className="text-sm font-medium">Afficher le détail des opérations</span>
                                        </label>
                                    </div>
                                </div>

                                <div ref={cashReportRef} className="bg-white p-8 max-w-4xl mx-auto shadow-lg print:shadow-none print:w-full">
                                    <div className="text-center mb-8 border-b pb-4">
                                        <h2 className="text-2xl font-black uppercase tracking-widest text-gray-900">Rapport de Caisse</h2>
                                        <p className="text-gray-500 mt-1">Période du {new Date(filters.startDate).toLocaleDateString()} au {new Date(filters.endDate).toLocaleDateString()}</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
                                        <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
                                            <p className="text-sm font-bold text-green-800 uppercase mb-1">Total Encaissé (Réel)</p>
                                            <p className="text-3xl font-black text-green-600">{formatCurrency(cashReportData.totalCashIn)}</p>
                                            <p className="text-xs text-green-700 mt-2">Somme des règlements perçus sur la période.</p>
                                        </div>

                                        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                                            <p className="text-sm font-bold text-indigo-800 uppercase mb-1">Bénéfice (Estimé)</p>
                                            <p className="text-3xl font-black text-indigo-600">{formatCurrency(cashReportData.totalProfit)}</p>
                                            <p className="text-xs text-indigo-700 mt-2">Total Ventes - Coût Marchandises (Sur la période).</p>
                                        </div>
                                        
                                        {cashFilters.includeCredits && (
                                            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                                                <p className="text-sm font-bold text-blue-800 uppercase mb-1">Chiffre d'Affaires (Théorique)</p>
                                                <p className="text-3xl font-black text-blue-600">{formatCurrency(cashReportData.totalSalesRevenue)}</p>
                                                <p className="text-xs text-blue-700 mt-2">Total des ventes validées (inclus crédits).</p>
                                            </div>
                                        )}
                                    </div>

                                    {cashFilters.includeCredits && (
                                        <div className="mb-8 p-4 bg-yellow-50 rounded-xl border border-yellow-100 flex justify-between items-center">
                                            <span className="font-bold text-yellow-800">Crédits accordés sur la période (Non encaissés)</span>
                                            <span className="font-black text-yellow-600 text-xl">{formatCurrency(cashReportData.totalCreditSalesValue)}</span>
                                        </div>
                                    )}

                                    {cashFilters.showDetailed && (
                                        <div className="mt-8">
                                            <h3 className="font-bold text-lg mb-4 border-b pb-2">Détail des Encaissements</h3>
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-gray-100">
                                                        <th className="p-2 text-left">Date</th>
                                                        <th className="p-2 text-left">Réf</th>
                                                        <th className="p-2 text-left">Mode</th>
                                                        <th className="p-2 text-right">Montant</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {cashReportData.payments.length === 0 ? (
                                                        <tr><td colSpan={4} className="p-4 text-center italic text-gray-500">Aucun encaissement sur cette période.</td></tr>
                                                    ) : (
                                                        cashReportData.payments.map((p, idx) => (
                                                            <tr key={idx}>
                                                                <td className="p-2">{new Date(p.date).toLocaleDateString()} {new Date(p.date).toLocaleTimeString()}</td>
                                                                <td className="p-2">{p.saleId ? (p.saleId.startsWith('OPENING') ? 'SOLDE OUVERTURE' : 'VENTE') : 'ACHAT'}</td>
                                                                <td className="p-2 uppercase text-xs font-bold">{p.method}</td>
                                                                <td className="p-2 text-right font-mono">{formatCurrency(p.amount)}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                                <tfoot className="border-t-2 border-black">
                                                    <tr>
                                                        <td colSpan={3} className="p-2 text-right font-black uppercase">Total Période</td>
                                                        <td className="p-2 text-right font-black">{formatCurrency(cashReportData.totalCashIn)}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    )}
                                    
                                    <div className="mt-12 text-center text-xs text-gray-400">
                                        <p>Rapport généré le {new Date().toLocaleDateString()} à {new Date().toLocaleTimeString()}</p>
                                        <p>Document à usage interne uniquement.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {activeReport === 'sales' && hasPermission('reports:sales') && (
                            <div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                    <StatCard title="Revenu Total" value={formatCurrency(salesReportData.totalRevenue)} />
                                    <StatCard title="Nombre de Ventes" value={salesReportData.salesCount} />
                                    <StatCard title="Vente Moyenne" value={formatCurrency(salesReportData.averageSaleValue)} />
                                </div>
                                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-gray-50 dark:bg-gray-700"><tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Réf.</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                        </tr></thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {filteredSales.map(s => <tr key={s.id}>
                                                <td className="px-6 py-4">{s.referenceNumber}</td>
                                                <td className="px-6 py-4">{getCustomerName(s.customerId)}</td>
                                                <td className="px-6 py-4">{formatDate(s.date)}</td>
                                                <td className="px-6 py-4 text-right">{formatCurrency(s.grandTotal)}</td>
                                            </tr>)}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {isAdmin && activeReport === 'profit' && hasPermission('reports:profit') && (
                             <div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                    <StatCard title="Revenu Total" value={formatCurrency(profitReportData.totalRevenue)} />
                                    <StatCard 
                                        title="Coût Marchandises (CMV)" 
                                        value={formatCurrency(profitReportData.totalCogs)}
                                        valueClassName="text-yellow-600 dark:text-yellow-400"
                                    />
                                    <StatCard 
                                        title="Profit Total" 
                                        value={formatCurrency(profitReportData.totalProfit)} 
                                        valueClassName={profitReportData.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                                    />
                                    <StatCard 
                                        title="Marge de Profit" 
                                        value={`${profitReportData.profitMargin.toFixed(2)}%`}
                                        valueClassName={profitReportData.profitMargin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                                    />
                                </div>
                                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-x-auto">
                                     <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-gray-50 dark:bg-gray-700"><tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Réf.</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenu</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Coût</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Profit</th>
                                        </tr></thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {profitReportData.salesWithProfit.map(s => <tr key={s.id}>
                                                <td className="px-6 py-4">{s.referenceNumber}</td>
                                                <td className="px-6 py-4">{formatDate(s.date)}</td>
                                                <td className="px-6 py-4 text-right">{formatCurrency(s.grandTotal)}</td>
                                                <td className="px-6 py-4 text-right text-yellow-600">{formatCurrency(s.cogs)}</td>
                                                <td className="px-6 py-4 text-right font-bold text-green-600">{formatCurrency(s.profit)}</td>
                                            </tr>)}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {activeReport === 'services' && hasPermission('reports:services') && (
                            <div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                    <StatCard title="Revenu Total des Services" value={formatCurrency(servicesReportData.totalRevenue)} />
                                    <StatCard title="Nombre de Services Vendus" value={servicesReportData.totalQuantity} />
                                    <StatCard title="Service le plus Vendu" value={servicesReportData.mostSoldService?.name || 'N/A'} subtext={servicesReportData.mostSoldService ? `${servicesReportData.mostSoldService.quantity} fois` : ''} />
                                </div>
                                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-gray-50 dark:bg-gray-700"><tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantité Vendue</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenu Total</th>
                                        </tr></thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {servicesReportData.servicesList.length === 0 && (
                                                <tr><td colSpan={3} className="text-center py-4">Aucun service vendu pour la période sélectionnée.</td></tr>
                                            )}
                                            {servicesReportData.servicesList.map(s => (
                                                <tr key={s.name}>
                                                    <td className="px-6 py-4 font-medium">{s.name}</td>
                                                    <td className="px-6 py-4 text-right">{s.quantity}</td>
                                                    <td className="px-6 py-4 text-right font-semibold">{formatCurrency(s.revenue)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {isAdmin && activeReport === 'stock_alert' && hasPermission('reports:stock_alert') && (
                            <div>
                                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-gray-50 dark:bg-gray-700"><tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock Actuel</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Niveau d'Alerte</th>
                                        </tr></thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {stockAlertData.length === 0 && <tr><td colSpan={4} className="text-center py-4">Aucun produit en alerte de stock.</td></tr>}
                                            {stockAlertData.map(p => {
                                                let currentStock: number;
                                                if (filters.warehouseId === 'all') {
                                                    const visibleWarehouseIds = userVisibleWarehouses.map(wh => wh.id);
                                                    currentStock = (p.stockLevels || []).filter(sl => visibleWarehouseIds.includes(sl.warehouseId)).reduce((sum, sl) => sum + sl.quantity, 0);
                                                } else {
                                                    currentStock = p.stockLevels?.find(sl => sl.warehouseId === filters.warehouseId)?.quantity || 0;
                                                }
                                                return (
                                                    <tr key={p.id}>
                                                        <td className="px-6 py-4 font-medium">{p.name}</td>
                                                        <td className="px-6 py-4">{p.sku}</td>
                                                        <td className="px-6 py-4 text-right font-bold text-red-500">{currentStock}</td>
                                                        <td className="px-6 py-4 text-right">{p.minStockAlert}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {activeReport === 'inventory_value' && hasPermission('reports:inventory_value') && (
                            <div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                    <StatCard title="Valeur Totale du Stock" value={formatCurrency(inventoryValueData.totalValue)} subtext="Basé sur le coût d'achat" />
                                </div>
                                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-x-auto">
                                    <h3 className="text-lg font-semibold p-4 border-b dark:border-gray-700">Valeur du Stock par Entrepôt</h3>
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entrepôt</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valeur Totale du Stock</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {inventoryValueData.valueByWarehouse.length === 0 && (
                                                <tr><td colSpan={2} className="text-center py-4">Aucune donnée de stock à afficher pour la sélection.</td></tr>
                                            )}
                                            {inventoryValueData.valueByWarehouse.map(wh => (
                                                <tr key={wh.warehouseId}>
                                                    <td className="px-6 py-4 whitespace-nowrap">{wh.warehouseName}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium">{formatCurrency(wh.totalValue)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ReportsPage;