
import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Sale, Customer, Product, Warehouse } from '../types';
import { WarningIcon, TrendingUpIcon, CustomersIcon, WarehouseIcon, ChartBarIcon, SparklesIcon } from '../constants';
import { useNavigate } from 'react-router-dom';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        try {
            const salesQuery = query(collection(db, "sales"), orderBy("date", "desc"));
            const [salesSnapshot, customersSnapshot, productsSnapshot, warehousesSnapshot] = await Promise.all([
                getDocs(salesQuery),
                getDocs(collection(db, "customers")),
                getDocs(collection(db, "products")),
                getDocs(collection(db, "warehouses")),
            ]);
            setSales(salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
            setCustomers(customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
            setProducts(productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
            setWarehouses(warehousesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse)));
        } catch (err: any) {
            console.error("Dashboard error", err);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, []);

  const formatCurrency = (value: number) => new Intl.NumberFormat('fr-FR').format(value) + ' FCFA';

  // Dictionnaire de thèmes avec classes Tailwind explicites pour éviter les erreurs de purge
  const THEMES: Record<string, any> = {
    amber: {
      card: "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700",
      text: "text-amber-700 dark:text-amber-300",
      heading: "text-amber-900 dark:text-amber-100",
      bar: "bg-amber-500",
      badge: "bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100",
      accent: "bg-white/50 dark:bg-black/20 border-amber-200 dark:border-amber-800"
    },
    blue: {
      card: "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
      text: "text-blue-700 dark:text-blue-300",
      heading: "text-blue-900 dark:text-blue-100",
      bar: "bg-blue-500",
      badge: "bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100",
      accent: "bg-white/50 dark:bg-black/20 border-blue-200 dark:border-blue-800"
    },
    emerald: {
      card: "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700",
      text: "text-emerald-700 dark:text-emerald-300",
      heading: "text-emerald-900 dark:text-emerald-100",
      bar: "bg-emerald-500",
      badge: "bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100",
      accent: "bg-white/50 dark:bg-black/20 border-emerald-200 dark:border-emerald-800"
    },
    rose: {
      card: "bg-rose-100 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700",
      text: "text-rose-700 dark:text-rose-300",
      heading: "text-rose-900 dark:text-rose-100",
      bar: "bg-rose-500",
      badge: "bg-rose-200 dark:bg-rose-800 text-rose-900 dark:text-rose-100",
      accent: "bg-white/50 dark:bg-black/20 border-rose-200 dark:border-rose-800"
    },
    purple: {
      card: "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700",
      text: "text-purple-700 dark:text-purple-300",
      heading: "text-purple-900 dark:text-purple-100",
      bar: "bg-purple-500",
      badge: "bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100",
      accent: "bg-white/50 dark:bg-black/20 border-purple-200 dark:border-purple-800"
    },
    indigo: {
      card: "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700",
      text: "text-indigo-700 dark:text-indigo-300",
      heading: "text-indigo-900 dark:text-indigo-100",
      bar: "bg-indigo-500",
      badge: "bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100",
      accent: "bg-white/50 dark:bg-black/20 border-indigo-200 dark:border-indigo-800"
    },
    cyan: {
      card: "bg-cyan-100 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700",
      text: "text-cyan-700 dark:text-cyan-300",
      heading: "text-cyan-900 dark:text-cyan-100",
      bar: "bg-cyan-500",
      badge: "bg-cyan-200 dark:bg-cyan-800 text-cyan-900 dark:text-cyan-100",
      accent: "bg-white/50 dark:bg-black/20 border-cyan-200 dark:border-cyan-800"
    },
    orange: {
      card: "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700",
      text: "text-orange-700 dark:text-orange-300",
      heading: "text-orange-900 dark:text-orange-100",
      bar: "bg-orange-500",
      badge: "bg-orange-200 dark:bg-orange-800 text-orange-900 dark:text-orange-100",
      accent: "bg-white/50 dark:bg-black/20 border-orange-200 dark:border-orange-800"
    }
  };

  const userVisibleWarehouses = useMemo(() => {
    if (!user) return [];
    if (user.role?.name.toLowerCase().includes('admin')) return warehouses;
    return warehouses.filter(wh => user.warehouseIds?.includes(wh.id));
  }, [user, warehouses]);

  const userVisibleSales = useMemo(() => {
    if (!user || !user.role) return [];
    if (user.role.name.toLowerCase().includes('admin')) return sales;
    const assignedWarehouseIds = user.warehouseIds || [];
    return sales.filter(sale => assignedWarehouseIds.includes(sale.warehouseId));
  }, [user, sales]);

  const warehouseStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const otherThemesKeys = ['blue', 'emerald', 'rose', 'purple', 'indigo', 'cyan', 'orange'];
    let colorIndex = 0;

    return userVisibleWarehouses.map(wh => {
        let totalValue = 0;
        let totalItems = 0;
        let dailyVendu = 0;
        let dailyBenefice = 0;

        // Calcul Stock
        products.forEach(p => {
            if (p.type === 'service') return;
            const stockLevel = p.stockLevels?.find(sl => sl.warehouseId === wh.id);
            if (stockLevel && stockLevel.quantity > 0) {
                totalValue += (stockLevel.quantity * (p.cost || 0));
                totalItems += stockLevel.quantity;
            }
        });

        // Calcul Ventes/Profit du jour
        userVisibleSales.forEach(sale => {
            if (sale.warehouseId !== wh.id) return;
            const saleDate = new Date(sale.date);
            if (saleDate >= today) {
                dailyVendu += sale.grandTotal;
                sale.items.forEach(item => {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        dailyBenefice += (item.price - (product.cost || 0)) * item.quantity;
                    }
                });
            }
        });

        // Attribution du Thème
        let themeKey = 'amber';
        if (!wh.isMain) {
          // Si une couleur est définie en base, on l'utilise, sinon on cycle
          themeKey = wh.color || otherThemesKeys[colorIndex % otherThemesKeys.length];
          colorIndex++;
        }

        return { 
          ...wh, 
          totalValue, 
          totalItems, 
          dailyVendu, 
          dailyBenefice,
          theme: THEMES[themeKey] || THEMES.blue
        };
    }).sort((a, b) => (a.isMain ? -1 : b.isMain ? 1 : b.totalValue - a.totalValue));
  }, [userVisibleWarehouses, products, userVisibleSales]);

  const globalStockValue = useMemo(() => warehouseStats.reduce((sum, wh) => sum + wh.totalValue, 0), [warehouseStats]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaysSales = userVisibleSales.filter(s => new Date(s.date) >= today);
    return {
      salesToday: todaysSales.reduce((sum, sale) => sum + sale.grandTotal, 0),
      totalRevenue: userVisibleSales.reduce((sum, sale) => sum + (sale.paidAmount || 0), 0),
      totalSales: userVisibleSales.length,
      activeCustomers: new Set(userVisibleSales.map(s => s.customerId)).size
    };
  }, [userVisibleSales]);

  if (loading) return <div className="p-24 text-center text-gray-400 font-black uppercase animate-pulse">Initialisation du Dashboard...</div>

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end px-2">
        <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Tableau de bord</h1>
            <p className="text-gray-500 dark:text-gray-400">Bienvenue au centre de contrôle, <span className="text-primary-600 font-bold">{user?.displayName || user?.username}</span>!</p>
        </div>
        <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</p>
            <p className="font-bold text-gray-700 dark:text-gray-300">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </header>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-[2rem] p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-xl text-green-600"><TrendingUpIcon className="w-6 h-6"/></div>
              <span className="text-[10px] font-black text-green-500 uppercase">Cumul</span>
          </div>
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Encaissements Totaux</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(stats.totalRevenue)}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-[2rem] p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600"><ChartBarIcon className="w-6 h-6"/></div>
              <span className="text-[10px] font-black text-blue-500 uppercase">Volume</span>
          </div>
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Transactions Ventes</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalSales}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-[2rem] p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-xl text-primary-600"><SparklesIcon className="w-6 h-6"/></div>
              <span className="text-[10px] font-black text-primary-500 uppercase">Aujourd'hui</span>
          </div>
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Ventes Globales Jour</p>
          <p className="text-2xl font-black text-primary-600">{formatCurrency(stats.salesToday)}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-[2rem] p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-xl text-gray-600"><CustomersIcon className="w-6 h-6"/></div>
              <span className="text-[10px] font-black text-gray-400 uppercase">Portefeuille</span>
          </div>
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Clients Servis</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.activeCustomers}</p>
        </div>
      </div>

      {/* WAREHOUSE CARDS SECTION */}
      <section className="space-y-6">
          <div className="flex items-center space-x-3 px-2">
            <div className="bg-gray-900 text-white p-2 rounded-xl"><WarehouseIcon className="w-5 h-5"/></div>
            <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Performance par Site</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {warehouseStats.map(wh => {
                  const percentage = globalStockValue > 0 ? (wh.totalValue / globalStockValue) * 100 : 0;
                  const theme = wh.theme;
                  
                  return (
                      <div key={wh.id} className={`group flex flex-col rounded-[2.5rem] border-2 shadow-sm transition-all hover:shadow-2xl hover:-translate-y-1 ${theme.card}`}>
                          {/* Top Section: Identity and Stock */}
                          <div className="p-7">
                              <div className="flex justify-between items-start mb-6">
                                  <div className="min-w-0">
                                    <h4 className={`text-base font-black uppercase tracking-tight truncate ${theme.heading}`}>{wh.name}</h4>
                                    <p className={`text-[9px] font-bold uppercase tracking-widest mt-1 opacity-70 ${theme.text}`}>{wh.location || 'Localisation non définie'}</p>
                                  </div>
                                  <span className={`text-[10px] font-black px-3 py-1 rounded-2xl shadow-sm border border-white/50 ${theme.badge}`}>
                                    {wh.totalItems.toLocaleString()} ART.
                                  </span>
                              </div>
                              
                              <div className="mb-6">
                                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 opacity-60 ${theme.text}`}>Capital Stocké</p>
                                  <p className={`text-2xl font-black ${theme.heading}`}>{formatCurrency(wh.totalValue)}</p>
                              </div>

                              <div className="space-y-2">
                                <div className="w-full bg-white/40 dark:bg-black/20 h-2.5 rounded-full overflow-hidden shadow-inner border border-white/30">
                                    <div 
                                        className={`${theme.bar} h-full transition-all duration-1000 shadow-md`} 
                                        style={{ width: `${percentage}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between items-center text-[9px] font-black opacity-60 uppercase tracking-tighter">
                                    <span className={theme.text}>{percentage.toFixed(1)}% de la valeur totale</span>
                                    {wh.isMain && <span className="bg-gray-900 text-white px-2 py-0.5 rounded-lg">SIÈGE</span>}
                                </div>
                              </div>
                          </div>

                          {/* REAL-TIME DAILY STATS (THE FOOTER) */}
                          <div className={`mt-auto p-7 pt-6 rounded-b-[2.5rem] border-t-2 border-dashed ${theme.accent}`}>
                              <div className="flex items-center space-x-2 mb-4">
                                  <SparklesIcon className={`w-4 h-4 ${theme.text} animate-pulse`} />
                                  <span className={`text-[11px] font-black uppercase tracking-widest ${theme.text}`}>Activité du Jour</span>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-6">
                                  <div className="space-y-1">
                                      <p className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Vendu</p>
                                      <p className={`text-base font-black ${theme.heading}`}>{formatCurrency(wh.dailyVendu)}</p>
                                  </div>
                                  <div className="text-right space-y-1">
                                      <p className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Bénéfice</p>
                                      <p className={`text-base font-black text-green-600 dark:text-green-400`}>+{formatCurrency(wh.dailyBenefice)}</p>
                                  </div>
                              </div>
                          </div>
                      </div>
                  );
              })}
          </div>
      </section>

      {/* RECENT SALES LIST */}
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 p-2 rounded-xl"><ChartBarIcon className="w-5 h-5"/></div>
              <h3 className="text-lg font-black uppercase tracking-tight text-gray-900 dark:text-white">Flux des ventes</h3>
            </div>
            <button onClick={() => navigate('/sales')} className="text-xs font-bold text-primary-600 hover:underline uppercase tracking-widest">Tout l'historique</button>
        </div>
        <div className="overflow-x-auto">
            <table className="min-w-full">
                <thead className="bg-gray-50/80 dark:bg-gray-900/50">
                    <tr>
                        <th className="px-8 py-4 text-left text-[10px] font-black uppercase text-gray-400 tracking-widest">Référence / Date</th>
                        <th className="px-8 py-4 text-left text-[10px] font-black uppercase text-gray-400 tracking-widest">Paiement</th>
                        <th className="px-8 py-4 text-right text-[10px] font-black uppercase text-gray-400 tracking-widest">Montant</th>
                    </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                    {userVisibleSales.slice(0, 6).map(sale => (
                        <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="px-8 py-5">
                                <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tighter">{sale.referenceNumber}</p>
                                <p className="text-[10px] text-gray-400 font-bold">{new Date(sale.date).toLocaleDateString('fr-FR')}</p>
                            </td>
                            <td className="px-8 py-5">
                                <span className={`px-3 py-1 rounded-full font-black uppercase text-[9px] tracking-widest ${sale.paymentStatus === 'Payé' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {sale.paymentStatus}
                                </span>
                            </td>
                            <td className="px-8 py-5 text-right text-base font-black text-gray-900 dark:text-white">{formatCurrency(sale.grandTotal)}</td>
                        </tr>
                    ))}
                    {userVisibleSales.length === 0 && (
                      <tr><td colSpan={3} className="py-12 text-center text-gray-400 italic">Aucune vente enregistrée.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
