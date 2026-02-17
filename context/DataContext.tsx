
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Warehouse, Category, Brand, Unit, Customer, Supplier, Product } from '../types';

interface DataContextType {
  warehouses: Warehouse[];
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  loading: boolean;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Écouteurs temps réel pour les collections de base (chargées une fois et mises à jour auto)
    const unsubWh = onSnapshot(collection(db, "warehouses"), (s) => setWarehouses(s.docs.map(d => ({id: d.id, ...d.data()} as Warehouse))));
    const unsubCat = onSnapshot(collection(db, "categories"), (s) => setCategories(s.docs.map(d => ({id: d.id, ...d.data()} as Category))));
    const unsubBra = onSnapshot(collection(db, "brands"), (s) => setBrands(s.docs.map(d => ({id: d.id, ...d.data()} as Brand))));
    const unsubUni = onSnapshot(collection(db, "units"), (s) => setUnits(s.docs.map(d => ({id: d.id, ...d.data()} as Unit))));
    const unsubCust = onSnapshot(collection(db, "customers"), (s) => setCustomers(s.docs.map(d => ({id: d.id, ...d.data()} as Customer))));
    const unsubSup = onSnapshot(collection(db, "suppliers"), (s) => setSuppliers(s.docs.map(d => ({id: d.id, ...d.data()} as Supplier))));
    const unsubProd = onSnapshot(collection(db, "products"), (s) => setProducts(s.docs.map(d => ({id: d.id, ...d.data()} as Product))));

    // On considère le chargement fini quand les entrepôts sont là (donnée critique)
    const timer = setTimeout(() => setLoading(false), 800);

    return () => {
      unsubWh(); unsubCat(); unsubBra(); unsubUni(); unsubCust(); unsubSup(); unsubProd();
      clearTimeout(timer);
    };
  }, []);

  return (
    <DataContext.Provider value={{ warehouses, categories, brands, units, customers, suppliers, products, loading }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
