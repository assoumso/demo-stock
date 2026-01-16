
import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DataProvider } from './context/DataContext'; // Import du nouveau provider
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PosPage = lazy(() => import('./pages/PosPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const ProductFormPage = lazy(() => import('./pages/ProductFormPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const StockAdjustmentsPage = lazy(() => import('./pages/StockAdjustmentsPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const SaleFormPage = lazy(() => import('./pages/SaleFormPage'));
const SaleInvoicePage = lazy(() => import('./pages/SaleInvoicePage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const CustomerFormPage = lazy(() => import('./pages/CustomerFormPage'));
const CustomerAccountPage = lazy(() => import('./pages/CustomerAccountPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const RolesPage = lazy(() => import('./pages/RolesPage'));
const WarehousesPage = lazy(() => import('./pages/WarehousesPage'));
const TransfersPage = lazy(() => import('./pages/TransfersPage'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'));
const SupplierFormPage = lazy(() => import('./pages/SupplierFormPage'));
const SupplierAccountPage = lazy(() => import('./pages/SupplierAccountPage'));
const BrandsPage = lazy(() => import('./pages/BrandsPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const UnitsPage = lazy(() => import('./pages/UnitsPage'));
const PurchasesPage = lazy(() => import('./pages/PurchasesPage'));
const PurchaseFormPage = lazy(() => import('./pages/PurchaseFormPage'));
const PurchaseInvoicePage = lazy(() => import('./pages/PurchaseInvoicePage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const BankPage = lazy(() => import('./pages/BankPage'));
const CreditNotesPage = lazy(() => import('./pages/CreditNotesPage'));
const CreditNoteFormPage = lazy(() => import('./pages/CreditNoteFormPage'));

const LoadingFallback = () => <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-400 font-black uppercase tracking-widest animate-pulse">Chargement...</div>;

const AppRoutes: React.FC = () => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingFallback />;

    return (
        <Routes>
            <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
            <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                <Route index element={<DashboardPage />} />
                <Route path="pos" element={<PosPage />} />
                <Route path="sales" element={<SalesPage />} />
                <Route path="sales/new" element={<SaleFormPage />} />
                <Route path="sales/edit/:id" element={<SaleFormPage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="products/new" element={<ProductFormPage />} />
                <Route path="products/edit/:id" element={<ProductFormPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="inventory/adjustments" element={<StockAdjustmentsPage />} />
                <Route path="purchases" element={<PurchasesPage />} />
                <Route path="purchases/new" element={<PurchaseFormPage />} />
                <Route path="purchases/edit/:id" element={<PurchaseFormPage />} />
                <Route path="transfers" element={<TransfersPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="bank" element={<BankPage />} />
                <Route path="credit-notes" element={<CreditNotesPage />} />
                <Route path="credit-notes/new" element={<CreditNoteFormPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="customers/new" element={<CustomerFormPage />} />
                <Route path="customers/edit/:id" element={<CustomerFormPage />} />
                <Route path="customers/account/:id" element={<CustomerAccountPage />} />
                <Route path="suppliers" element={<SuppliersPage />} />
                <Route path="suppliers/new" element={<SupplierFormPage />} />
                <Route path="suppliers/edit/:id" element={<SupplierFormPage />} />
                <Route path="suppliers/account/:id" element={<SupplierAccountPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="roles" element={<RolesPage />} />
                <Route path="warehouses" element={<WarehousesPage />} />
                <Route path="brands" element={<BrandsPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="units" element={<UnitsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
            <Route path="/purchases/invoice/:id" element={<ProtectedRoute><PurchaseInvoicePage /></ProtectedRoute>} />
            <Route path="/sales/invoice/:id" element={<ProtectedRoute><SaleInvoicePage /></ProtectedRoute>} />
        </Routes>
    );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <DataProvider>
          <HashRouter>
              <Suspense fallback={<LoadingFallback />}>
                  <AppRoutes />
              </Suspense>
          </HashRouter>
        </DataProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
