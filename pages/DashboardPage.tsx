
import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Sale, Customer, Product, Warehouse } from '../types';
import { WarningIcon, TrendingUpIcon, CustomersIcon, WarehouseIcon, ChartBarIcon, SparklesIcon, ProductsIcon, PaymentIcon } from '../constants';
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

  const stats = useMemo(() => {
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0,0,0,0);
        return d;
    });

    const dailyRevenue = last7Days.map(date => {
        const dayTotal = sales
            .filter(s => new Date(s.date).toDateString() === date.toDateString())
            .reduce((sum, s) => sum + s.grandTotal, 0);
        return { label: date.toLocaleDateString('fr-FR', { weekday: 'short' }), value: dayTotal };
    });

    const maxDaily = Math.max(...dailyRevenue.map(d => d.value), 1);

    const productPerf: Record<string, { name: string, qty: number, rev: number }> = {};
    const customerPerf: Record<string, { name: string, total: number, debt: number }> = {};

    sales.forEach(sale => {
        if (!customerPerf[sale.customerId]) {
            const c = customers.find(cust => cust.id === sale.customerId);
            customerPerf[sale.customerId] = { name: c?.name || 'Passage', total: 0, debt: 0 };
        }
        customerPerf[sale.customerId].total += sale.grandTotal;
        customerPerf[sale.customerId].debt += (sale.grandTotal - sale.paidAmount);

        sale.items.forEach(item => {
            if (!productPerf[item.productId]) {
                const p = products.find(prod => prod.id === item.productId);
                productPerf[item.productId] = { name: p?.name || 'Inconnu', qty: 0, rev: 0 };
            }
            productPerf[item.productId].qty += item.quantity;
            productPerf[item.productId].rev += item.subtotal;
        });
    });

    const topProducts = Object.values(productPerf).sort((a, b) => b.qty - a.qty).slice(0, 5);
    const topCustomers = Object.values(customerPerf).sort((a, b) => b.total - a.total).slice(0, 5);
    const totalRevenue = sales.reduce((sum, s) => sum + s.grandTotal, 0);
    const totalCollected = sales.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
    
    let estProfit = 0;
    sales.forEach(s => s.items.forEach(i => {
        const p = products.find(prod => prod.id === i.productId);
        if(p) estProfit += (i.price - p.cost) * i.quantity;
    }));

    return { dailyRevenue, maxDaily, topProducts, topCustomers, totalRevenue, totalCollected, estProfit, avgSale: sales.length ? totalRevenue / sales.length : 0 };
  }, [sales, products, customers]);

  if (loading) return <div className="p-24 text-center text-gray-400 font-black uppercase animate-pulse">Chargement du tableau de bord...</div>

  return (
    <div className="space-y-10 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end px-2 gap-4">
        <div>
            <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Tableau de bord</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 font-bold uppercase text-xs tracking-widest">Performances globales</p>
        </div>
      </header>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-[2rem] p-6 border-b-4 border-primary-500">
          <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Total Encaissé</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(stats.totalCollected)}</p>
          <div className="flex items-center mt-2 text-[10px] font-black uppercase text-green-500"><TrendingUpIcon className="w-3 h-3 mr-1"/> Cash réel</div>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-[2rem] p-6 border-b-4 border-red-500">
          <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Reste à Recouvrer</p>
          <p className="text-2xl font-black text-red-600">{formatCurrency(stats.totalRevenue - stats.totalCollected)}</p>
          <div className="flex items-center mt-2 text-[10px] font-black uppercase text-red-400"><WarningIcon className="w-3 h-3 mr-1"/> Créances</div>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-[2rem] p-6 border-b-4 border-green-500">
          <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Bénéfice Brut Est.</p>
          <p className="text-2xl font-black text-green-600">{formatCurrency(stats.estProfit)}</p>
          <div className="flex items-center mt-2 text-[10px] font-black uppercase text-green-500"><SparklesIcon className="w-3 h-3 mr-1"/> Estimé</div>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-[2rem] p-6 border-b-4 border-blue-500">
          <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Panier Moyen</p>
          <p className="text-2xl font-black text-blue-600">{formatCurrency(stats.avgSale)}</p>
          <div className="flex items-center mt-2 text-[10px] font-black uppercase text-blue-400"><ChartBarIcon className="w-3 h-3 mr-1"/> {sales.length} ventes</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 shadow-2xl rounded-[2.5rem] p-8 border dark:border-gray-700">
              <h3 className="text-lg font-black uppercase tracking-tight flex items-center mb-8"><ChartBarIcon className="w-5 h-5 mr-3 text-primary-500"/>Activité des 7 derniers jours</h3>
              <div className="flex items-end justify-between h-48 gap-2">
                  {stats.dailyRevenue.map((day, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center group">
                          <div className="relative w-full flex justify-center items-end h-32">
                              <div className="w-full sm:w-12 bg-primary-500 rounded-t-xl transition-all duration-500 group-hover:bg-primary-600" style={{ height: `${(day.value / stats.maxDaily) * 100}%` }}>
                                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] px-2 py-1 rounded font-black whitespace-nowrap">{formatCurrency(day.value)}</div>
                              </div>
                          </div>
                          <span className="mt-4 text-[10px] font-black text-gray-400 uppercase">{day.label}</span>
                      </div>
                  ))}
              </div>
          </div>
          <div className="bg-gray-900 text-white shadow-2xl rounded-[2.5rem] p-8 relative overflow-hidden">
              <h3 className="text-lg font-black uppercase tracking-tight mb-8">Flux de Trésorerie</h3>
              <div className="space-y-6 relative z-10">
                  <div>
                      <div className="flex justify-between text-[10px] font-black uppercase text-gray-400 mb-2"><span>Recouvré</span><span className="text-green-400">{((stats.totalCollected/stats.totalRevenue)*100).toFixed(1)}%</span></div>
                      <div className="h-4 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${(stats.totalCollected/stats.totalRevenue)*100}%` }}></div></div>
                  </div>
                  <div>
                      <div className="flex justify-between text-[10px] font-black uppercase text-gray-400 mb-2"><span>En attente</span><span className="text-red-400">{(((stats.totalRevenue-stats.totalCollected)/stats.totalRevenue)*100).toFixed(1)}%</span></div>
                      <div className="h-4 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-red-500" style={{ width: `${((stats.totalRevenue-stats.totalCollected)/stats.totalRevenue)*100}%` }}></div></div>
                  </div>
                  <div className="pt-6 border-t border-gray-800"><p className="text-[10px] font-black text-gray-500 uppercase mb-1">C.A Global</p><p className="text-3xl font-black text-white">{formatCurrency(stats.totalRevenue)}</p></div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-[2.5rem] p-8 border dark:border-gray-700">
              <h3 className="text-lg font-black uppercase mb-6 flex items-center"><ProductsIcon className="w-5 h-5 mr-3 text-orange-500"/>Top 5 Produits vendus</h3>
              <div className="space-y-4">
                  {stats.topProducts.map((p, i) => (
                      <div key={i} className="flex items-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                          <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center font-black mr-4">{i+1}</div>
                          <div className="flex-1 min-w-0"><p className="text-sm font-black uppercase truncate">{p.name}</p><p className="text-[10px] text-gray-400 font-bold">{p.qty} unités vendues</p></div>
                          <p className="text-sm font-black text-primary-600">{formatCurrency(p.rev)}</p>
                      </div>
                  ))}
              </div>
          </div>
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-[2.5rem] p-8 border dark:border-gray-700">
              <h3 className="text-lg font-black uppercase mb-6 flex items-center"><CustomersIcon className="w-5 h-5 mr-3 text-blue-500"/>Top 5 Meilleurs Clients</h3>
              <div className="space-y-4">
                  {stats.topCustomers.map((c, i) => (
                      <div key={i} className="flex items-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-black mr-4">{i+1}</div>
                          <div className="flex-1 min-w-0"><p className="text-sm font-black uppercase truncate">{c.name}</p><p className="text-[10px] text-gray-400 font-bold">Total commandé</p></div>
                          <div className="text-right"><p className="text-sm font-black">{formatCurrency(c.total)}</p>{c.debt > 0 && <p className="text-[9px] font-black text-red-500 uppercase">Dette: {formatCurrency(c.debt)}</p>}</div>
                      </div>
                  ))}
              </div>
          </div>
      </div>
    </div>
  );
};

export default DashboardPage;
