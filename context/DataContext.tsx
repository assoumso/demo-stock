
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../supabase';
import { Warehouse, Category, Brand, Unit, Customer, Supplier, Product, AppSettings, Sale, Purchase, Expense, ExpenseCategory } from '../types';

interface DataContextType {
  warehouses: Warehouse[];
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  settings: AppSettings | null;
  recentSales: Sale[];
  recentPurchases: Purchase[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  loading: boolean;
  productsLoading: boolean;
  customersLoading: boolean;
  suppliersLoading: boolean;
  salesLoading: boolean;
  purchasesLoading: boolean;
  expensesLoading: boolean;
  refreshData: (tables?: string[]) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [recentPurchases, setRecentPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  // Specific loading states for large datasets
  const [productsLoading, setProductsLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(true);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [expensesLoading, setExpensesLoading] = useState(true);
  


  const fetchData = async (tables?: string[]) => {
    const shouldFetch = (table: string) => !tables || tables.includes(table);
    const fetchConfig = shouldFetch('config');

    if (fetchConfig) setLoading(true);
    if (shouldFetch('products')) setProductsLoading(true);
    if (shouldFetch('customers')) setCustomersLoading(true);
    if (shouldFetch('suppliers')) setSuppliersLoading(true);
    if (shouldFetch('sales')) setSalesLoading(true);
    if (shouldFetch('purchases')) setPurchasesLoading(true);
    if (shouldFetch('expenses')) setExpensesLoading(true);
    
    try {
        // 1. Fetch small configuration tables first (fast)
        if (fetchConfig) {
            const [whRes, catRes, braRes, uniRes, expCatRes] = await Promise.all([
                supabase.from('warehouses').select('*'),
                supabase.from('categories').select('*'),
                supabase.from('brands').select('*'),
                supabase.from('units').select('*'),
                supabase.from('expense_categories').select('*'),
            ]);

            // Settings is a single doc usually
            const { data: settingsData } = await supabase.from('app_settings').select('*').limit(1).single();
            if (settingsData) {
                setSettings(settingsData as AppSettings);
            }

            if (whRes.data) setWarehouses(whRes.data as Warehouse[]);
            if (catRes.data) setCategories(catRes.data as Category[]);
            if (braRes.data) setBrands(braRes.data as Brand[]);
            if (uniRes.data) setUnits(uniRes.data as Unit[]);
            if (expCatRes.data) setExpenseCategories(expCatRes.data as ExpenseCategory[]);
            
            // Mark initial loading as done so the app can render the layout
            setLoading(false);
        }

        // 2. Fetch larger datasets in parallel but independently to not block each other
        const fetchTable = async (table: string, setter: (data: any) => void, loader: (loading: boolean) => void) => {
            if (!shouldFetch(table)) return;
            try {
                const { data, error } = await supabase.from(table).select('*').order(
                    (table === 'sales' || table === 'purchases' || table === 'expenses') ? 'date' : 'id', 
                    { ascending: false }
                ).limit((table === 'sales' || table === 'purchases' || table === 'expenses') ? 50 : 1000);
                
                if (error) throw error;
                if (data) setter(data);
            } catch (error) {
                console.error(`Error fetching ${table}:`, error);
            } finally {
                loader(false);
            }
        };

        await Promise.all([
            fetchTable('customers', setCustomers, setCustomersLoading),
            fetchTable('suppliers', setSuppliers, setSuppliersLoading),
            fetchTable('products', (data) => {
                console.log(`📦 Fetched ${data.length} products from Supabase`);
                setProducts(data);
            }, setProductsLoading),
            fetchTable('sales', setRecentSales, setSalesLoading),
            fetchTable('purchases', setRecentPurchases, setPurchasesLoading),
            fetchTable('expenses', setExpenses, setExpensesLoading),
        ]);
        
    } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
        setLoading(false);
        setProductsLoading(false);
        setCustomersLoading(false);
        setSuppliersLoading(false);
        setSalesLoading(false);
        setPurchasesLoading(false);
        setExpensesLoading(false);
    }
  };

  useEffect(() => {
    fetchData(); // Fetch all on mount

    // Configuration des souscriptions temps réel (Optionnel mais recommandé)
    // Pour l'instant on fait simple avec un chargement initial
    // TODO: Ajouter onSnapshot() pour écouter les changements
  }, []);

  const value = {
    warehouses,
    categories,
    brands,
    units,
    customers,
    suppliers,
    products,
    settings,
    recentSales,
    recentPurchases,
    expenses,
    expenseCategories,
    loading,
    productsLoading,
    customersLoading,
    suppliersLoading,
    salesLoading,
    purchasesLoading,
    expensesLoading,
    refreshData: fetchData
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
