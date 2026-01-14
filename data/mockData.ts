// FIX: Created mock data for the application to use.
// This file was previously a placeholder, causing module resolution errors across various pages.
// FIX: Added Brand and Unit to the import.
import { Product, Category, Warehouse, Order, Customer, WarehouseTransfer, Supplier, Brand, Unit, Sale } from '../types';

export const mockWarehouses: Warehouse[] = [
  { id: 'wh1', name: 'Entrepôt Principal', location: 'Cotonou, Gbégamey', isMain: true },
  { id: 'wh2', name: 'Entrepôt Secondaire', location: 'Calavi, Zogbadjè', isMain: false },
];

export const mockCategories: Category[] = [
  { id: 'cat1', name: 'Boissons' },
  { id: 'cat2', name: 'Céréales' },
  { id: 'cat3', name: 'Produits Laitiers' },
];

// FIX: Added mock data for brands and units to be referenced by products.
export const mockBrands: Brand[] = [
  { id: 'brand1', name: 'Coca-Cola' },
  { id: 'brand2', name: 'Uncle Sam' },
  { id: 'brand3', name: 'Peak' },
];

export const mockUnits: Unit[] = [
    { id: 'unit1', name: 'Casier' },
    { id: 'unit2', name: 'Sac' },
    { id: 'unit3', name: 'Carton' },
];


export const mockProducts: Product[] = [
  {
    id: 'prod1',
    // FIX: Added missing 'type' property to conform to the Product type.
    type: 'product',
    name: 'Coca-Cola (Casier)',
    sku: 'CC-CAS-24',
    // FIX: Changed `brand` and `unit` to `brandId` and `unitId` to match the Product type definition.
    brandId: 'brand1',
    unitId: 'unit1',
    imageUrl: 'https://via.placeholder.com/40',
    description: 'Casier de 24 bouteilles de 33cl',
    upc_ean: '5449000000996',
    categoryId: 'cat1',
    cost: 5800,
    price: 6500,
    wholesalePrice: 6200,
    taxRate: 0.18,
    minStockAlert: 20,
    stockLevels: [
      { warehouseId: 'wh1', quantity: 150 },
      { warehouseId: 'wh2', quantity: 75 },
    ],
  },
  {
    id: 'prod2',
    // FIX: Added missing 'type' property to conform to the Product type.
    type: 'product',
    name: 'Riz 50kg (Sac)',
    sku: 'RIZ-SAC-50',
    // FIX: Changed `brand` and `unit` to `brandId` and `unitId` to match the Product type definition.
    brandId: 'brand2',
    unitId: 'unit2',
    imageUrl: 'https://via.placeholder.com/40',
    description: 'Sac de riz parfumé de 50kg, origine Thaïlande',
    upc_ean: '8850000001234',
    categoryId: 'cat2',
    cost: 22500,
    price: 25000,
    wholesalePrice: 24000,
    taxRate: 0,
    minStockAlert: 10,
    stockLevels: [
      { warehouseId: 'wh1', quantity: 200 },
      { warehouseId: 'wh2', quantity: 120 },
    ],
  },
  {
    id: 'prod3',
    // FIX: Added missing 'type' property to conform to the Product type.
    type: 'product',
    name: 'Lait Peak (Carton)',
    sku: 'LP-CAR-48',
    // FIX: Changed `brand` and `unit` to `brandId` and `unitId` to match the Product type definition.
    brandId: 'brand3',
    unitId: 'unit3',
    imageUrl: '', // No image example
    description: 'Carton de 48 boîtes de lait concentré non sucré',
    upc_ean: '6156000012345',
    categoryId: 'cat3',
    cost: 17000,
    price: 18000,
    wholesalePrice: 17500,
    taxRate: 0.18,
    minStockAlert: 15,
    stockLevels: [
      { warehouseId: 'wh1', quantity: 80 },
    ],
  },
];

// Note: Using mock UIDs for demonstration purposes.
export const mockOrders: Order[] = [
    { id: 'ord1', orderNumber: 'ORD-2024-001', customerName: 'Client A', createdAt: new Date().toISOString(), total: 31500, status: 'Payée', createdByUserId: 'mock-staff-uid', warehouseId: 'wh1' },
    { id: 'ord2', orderNumber: 'ORD-2024-002', customerName: 'Client B', createdAt: new Date(Date.now() - 86400000).toISOString(), total: 18000, status: 'En attente', createdByUserId: 'mock-admin-uid', warehouseId: 'wh2' },
    { id: 'ord3', orderNumber: 'ORD-2024-003', customerName: 'Client C', createdAt: new Date(Date.now() - 172800000).toISOString(), total: 6500, status: 'Annulée', createdByUserId: 'mock-staff-uid', warehouseId: 'wh1' },
    { id: 'ord4', orderNumber: 'ORD-2024-004', customerName: 'Client D', createdAt: new Date().toISOString(), total: 125000, status: 'Payée', createdByUserId: 'mock-admin-uid', warehouseId: 'wh1' },
    { id: 'ord5', orderNumber: 'ORD-2024-005', customerName: 'Client E', createdAt: new Date(Date.now() - 86400000).toISOString(), total: 72000, status: 'Payée', createdByUserId: 'mock-staff-uid', warehouseId: 'wh2' },
];

export const mockSales: Sale[] = [
    { id: 'sale1', referenceNumber: 'VNT-2024-001', customerId: 'cust1', date: new Date().toISOString(), grandTotal: 31500, paidAmount: 31500, saleStatus: 'Complétée', paymentStatus: 'Payé', warehouseId: 'wh1', items: [] },
    { id: 'sale2', referenceNumber: 'VNT-2024-002', customerId: 'cust2', date: new Date(Date.now() - 86400000).toISOString(), grandTotal: 18000, paidAmount: 0, saleStatus: 'Complétée', paymentStatus: 'En attente', warehouseId: 'wh2', items: [] },
    { id: 'sale3', referenceNumber: 'VNT-2024-003', customerId: 'cust3', date: new Date(Date.now() - 172800000).toISOString(), grandTotal: 6500, paidAmount: 6500, saleStatus: 'Complétée', paymentStatus: 'Payé', warehouseId: 'wh1', items: [] },
    { id: 'sale4', referenceNumber: 'VNT-2024-004', customerId: 'cust1', date: new Date().toISOString(), grandTotal: 125000, paidAmount: 100000, saleStatus: 'Complétée', paymentStatus: 'Partiel', warehouseId: 'wh1', items: [] },
    { id: 'sale5', referenceNumber: 'VNT-2024-005', customerId: 'cust2', date: new Date(Date.now() - 86400000).toISOString(), grandTotal: 72000, paidAmount: 72000, saleStatus: 'Complétée', paymentStatus: 'Payé', warehouseId: 'wh2', items: [] },
    { id: 'sale6', referenceNumber: 'VNT-2024-006', customerId: 'cust3', date: new Date(Date.now() - 2*86400000).toISOString(), grandTotal: 50000, paidAmount: 50000, saleStatus: 'Complétée', paymentStatus: 'Payé', warehouseId: 'wh2', items: [] },
    { id: 'sale7', referenceNumber: 'VNT-2024-007', customerId: 'cust1', date: new Date(Date.now() - 3*86400000).toISOString(), grandTotal: 88000, paidAmount: 0, saleStatus: 'Complétée', paymentStatus: 'En attente', warehouseId: 'wh1', items: [] },
];

export const mockCustomers: Customer[] = [
    { id: 'cust1', name: 'Supermarché La Confiance', email: 'contact@confiance.bj', phone: '+229 97000001' },
    { id: 'cust2', name: 'Boutique Chez Maman Yabo', email: 'yabo@yahoo.fr', phone: '+229 95000002' },
    { id: 'cust3', name: 'Hôtel du Lac', email: 'reservations@hoteldulac.bj', phone: '+229 66000003' },
];

export const mockTransfers: WarehouseTransfer[] = [
    { id: 'tr1', date: new Date().toISOString(), fromWarehouseId: 'wh1', toWarehouseId: 'wh2', productId: 'prod1', quantity: 20, status: 'Complété' },
    { id: 'tr2', date: new Date(Date.now() - 86400000).toISOString(), fromWarehouseId: 'wh1', toWarehouseId: 'wh2', productId: 'prod2', quantity: 10, status: 'En attente' },
];

export const mockSuppliers: Supplier[] = [
    { id: 'sup1', name: 'SOBEBRA', contactPerson: 'Mr. Dossou', phone: '+229 21000001', email: 'ventes@sobebra.bj', address: 'Zone Industrielle, Cotonou' },
    { id: 'sup2', name: 'AgroPlus Benin', contactPerson: 'Mme. Chabi', phone: '+229 21000002', email: 'contact@agroplus.bj', address: 'Route de Ouidah, Pahou' },
];