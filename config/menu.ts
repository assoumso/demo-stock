
import React from 'react';
import {
    DashboardIcon, PosIcon, ProductsIcon, InventoryIcon, OrdersIcon, CustomersIcon, ReportsIcon,
    UsersIcon, RolesIcon, SettingsIcon, WarehouseIcon, TransferIcon, SuppliersIcon, BrandIcon, CategoryIcon, UnitIcon, PurchaseIcon, PaymentIcon
} from '../constants';

interface MenuItem {
  to: string;
  icon: React.ReactElement;
  text: string;
}

interface MenuGroup {
  title: string;
  colorClass: string;
  items: MenuItem[];
}

export const menuConfig: MenuGroup[] = [
  {
    title: 'Principal',
    colorClass: 'text-green-400',
    items: [
      { to: 'dashboard', icon: React.createElement(DashboardIcon), text: 'Tableau de bord' },
      { to: 'pos', icon: React.createElement(PosIcon), text: 'Point de Vente (POS)' },
    ],
  },
  {
    title: 'Gestion',
    colorClass: 'text-blue-400',
    items: [
      { to: 'sales', icon: React.createElement(OrdersIcon), text: 'Ventes' },
      { to: 'products', icon: React.createElement(ProductsIcon), text: 'Produits' },
      { to: 'inventory', icon: React.createElement(InventoryIcon), text: 'Stocks' },
      { to: 'purchases', icon: React.createElement(PurchaseIcon), text: 'Achats' },
      { to: 'transfers', icon: React.createElement(TransferIcon), text: 'Transferts' },
      { to: 'payments', icon: React.createElement(PaymentIcon), text: 'Règlements' },
    ],
  },
  {
    title: 'Relations',
    colorClass: 'text-purple-400',
    items: [
      { to: 'customers', icon: React.createElement(CustomersIcon), text: 'Clients' },
      { to: 'suppliers', icon: React.createElement(SuppliersIcon), text: 'Fournisseurs' },
    ],
  },
  {
    title: 'Analyse',
    colorClass: 'text-yellow-400',
    items: [
      { to: 'reports', icon: React.createElement(ReportsIcon), text: 'Rapports' },
    ],
  },
  {
    title: 'Configuration',
    colorClass: 'text-red-400',
    items: [
      { to: 'users', icon: React.createElement(UsersIcon), text: 'Utilisateurs' },
      { to: 'roles', icon: React.createElement(RolesIcon), text: 'Rôles & Permissions' },
      { to: 'warehouses', icon: React.createElement(WarehouseIcon), text: 'Entrepôts' },
      { to: 'brands', icon: React.createElement(BrandIcon), text: 'Marques' },
      { to: 'categories', icon: React.createElement(CategoryIcon), text: 'Catégories' },
      { to: 'units', icon: React.createElement(UnitIcon), text: 'Unités' },
      { to: 'settings', icon: React.createElement(SettingsIcon), text: 'Paramètres' },
    ],
  },
];
