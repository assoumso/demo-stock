
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../supabase';
import { Sale, Customer } from '../types';
import { SearchIcon, LogoutIcon } from '../constants';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

interface NotificationItem {
    id: string;
    title: string;
    description: string;
    actionUrl: string;
    type: 'warning' | 'error';
}

const Header: React.FC<HeaderProps> = ({ sidebarOpen, setSidebarOpen }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [alerts, setAlerts] = useState<NotificationItem[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

    // Format currency inline for alerts
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(amount);
    };

    useEffect(() => {
        const fetchAlerts = async () => {
            if (!user) return;
            try {
                const [salesRes, custRes] = await Promise.all([
                    supabase.from('sales').select('*'),
                    supabase.from('customers').select('*')
                ]);

                const sales = (salesRes.data || []) as Sale[];
                const customers = (custRes.data || []) as Customer[];
                const now = new Date();
                const newAlerts: NotificationItem[] = [];

                const customerMap = customers.reduce((acc, cust) => { acc[cust.id] = cust; return acc; }, {} as any);

                // 1. Calculer les soldes actuels par client
                const balanceMap: Record<string, number> = {};
                sales.forEach(sale => {
                    const unpaid = sale.grandTotal - (sale.paidAmount || 0);
                    balanceMap[sale.customerId] = (balanceMap[sale.customerId] || 0) + unpaid;
                });

                // Alertes Échéances (Ventes)
                sales.forEach(sale => {
                    if (!sale.paymentDueDate || sale.paymentStatus === 'Payé') return;
                    if (!user.role?.name?.toLowerCase().includes('admin') && !user.warehouseIds?.includes(sale.warehouseId)) return;
                    
                    const dueDate = new Date(sale.paymentDueDate);
                    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
                    if (diffDays <= 2) {
                        const custName = customerMap[sale.customerId]?.name || 'Unknown';
                        newAlerts.push({
                            id: `sale_${sale.id}`,
                            title: `Facture échue / à échoir - ${sale.referenceNumber}`,
                            description: `${custName} (Échéance: ${dueDate.toLocaleDateString('fr-FR')})`,
                            actionUrl: `/customers/account/${sale.customerId}`,
                            type: diffDays < 0 ? 'error' : 'warning'
                        });
                    }
                });

                // Alertes Plafonds (Clients)
                customers.forEach(cust => {
                    if (cust.isCreditLimited && cust.creditLimit) {
                        const currentBalance = balanceMap[cust.id] || 0;
                        if (currentBalance > cust.creditLimit) {
                            newAlerts.push({
                                id: `cust_${cust.id}`,
                                title: `Plafond de crédit dépassé`,
                                description: `${cust.name} - Solde: ${formatCurrency(currentBalance)} / Max: ${formatCurrency(cust.creditLimit)}`,
                                actionUrl: `/customers/account/${cust.id}`,
                                type: 'error'
                            });
                        }
                    }
                });

                setAlerts(newAlerts);
            } catch (err) {
                console.warn("Échec chargement notifs", err);
            }
        };
        fetchAlerts();
        const interval = setInterval(fetchAlerts, 60000);
        return () => clearInterval(interval);
    }, [user]);

    const getRoleBadgeClasses = (roleName: string) => {
        if (roleName.toLowerCase().includes('admin')) return { backgroundColor: '#dcfce7', color: '#166534' };
        return { backgroundColor: '#e0e7ff', color: '#3730a3' };
    };
    
  return (
    <header className="sticky top-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 z-30">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 -mb-px">

          <div className="flex items-center">
            <button
              className="text-gray-500 hover:text-gray-600 lg:hidden mr-4"
              onClick={(e) => { e.stopPropagation(); setSidebarOpen(!sidebarOpen); }}
            >
              <span className="sr-only">Open sidebar</span>
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="2" /><rect x="4" y="11" width="16" height="2" /><rect x="4" y="17" width="16" height="2" /></svg>
            </button>
            
            <div className="relative hidden sm:block">
                <input className="bg-gray-100 dark:bg-gray-700/50 border-none rounded-full pl-10 pr-4 py-2 text-sm w-64 focus:ring-2 focus:ring-primary-500 transition-all" type="search" placeholder="Recherche rapide..." />
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-6">
            
            <div className="relative">
                <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 text-gray-400 hover:text-red-600 transition-colors bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                    title="Alertes de crédit et paiements"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {alerts.length > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white ring-2 ring-white dark:ring-gray-800 animate-bounce">
                            {alerts.length}
                        </span>
                    )}
                </button>

                {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden transform opacity-100 scale-100 transition-all origin-top-right">
                        <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                            <h3 className="font-black text-sm uppercase text-gray-900 dark:text-white">Notifications</h3>
                            <button onClick={() => navigate('/reports')} className="text-[10px] text-primary-600 hover:underline font-bold uppercase">Voir tout</button>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {alerts.length === 0 ? (
                                <div className="p-6 text-center text-sm text-gray-500 font-medium">
                                    Aucune alerte 🚀
                                </div>
                            ) : (
                                alerts.map(alert => (
                                    <div 
                                        key={alert.id}
                                        onClick={() => {
                                            setSelectedAlertId(alert.id);
                                            navigate(alert.actionUrl);
                                            setShowNotifications(false);
                                        }}
                                        className={`p-3 border-b border-gray-50 dark:border-gray-700/50 cursor-pointer transition-colors ${selectedAlertId === alert.id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${alert.type === 'error' ? 'bg-red-500' : 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]'}`}></div>
                                            <div>
                                                <h4 className={`text-xs font-bold leading-tight ${selectedAlertId === alert.id ? 'text-primary-600' : 'text-gray-900 dark:text-gray-100'}`}>{alert.title}</h4>
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-medium leading-relaxed">{alert.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center space-x-4 border-l dark:border-gray-700 pl-4 sm:pl-6">
                <div className="hidden md:flex flex-col items-end">
                    <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{user?.displayName || user?.username}</span>
                    {user?.role && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md mt-0.5" style={getRoleBadgeClasses(user.role.name)}>{user.role.name}</span>
                    )}
                </div>
                <button 
                    onClick={logout} 
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all active:scale-90"
                    title="Se déconnecter"
                >
                    <LogoutIcon className="w-6 h-6" />
                </button>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};

export default Header;
