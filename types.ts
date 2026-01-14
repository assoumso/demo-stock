
// types.ts

/**
 * User identity and authentication data.
 */
export interface User {
  uid: string;
  username: string;
  displayName: string;
  password?: string;
  roleId: string;
  warehouseIds?: string[];
}

/**
 * Role definition with associated permissions and warehouse restrictions.
 */
export interface Role {
  id: string;
  name: string;
  permissions: string[];
  warehouseIds?: string[];
}

/**
 * Base interface for both Customers and Suppliers.
 */
export interface BasePartner {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  businessName?: string;
  address?: string;
  city?: string;
  nif?: string;
  rccm?: string;
  website?: string;
  notes?: string;
}

/**
 * Customer profile with credit management and opening balance.
 */
export interface Customer extends BasePartner {
  isCreditLimited?: boolean;
  creditLimit?: number;
  openingBalance?: number;
  openingBalanceDate?: string;
}

/**
 * Supplier profile.
 */
export interface Supplier extends BasePartner {
  // Add supplier-specific fields here if needed
}

/**
 * Stock quantity per warehouse.
 */
export interface StockLevel {
  warehouseId: string;
  quantity: number;
}

/**
 * Product or Service definition.
 */
export interface Product {
  id: string;
  type: 'product' | 'service';
  name: string;
  sku: string;
  brandId?: string;
  unitId?: string;
  imageUrl?: string;
  description?: string;
  upc_ean?: string;
  categoryId: string;
  cost: number;
  price: number;
  wholesalePrice?: number;
  taxRate?: number;
  taxInclusive?: boolean;
  minStockAlert: number;
  stockLevels?: StockLevel[];
}

/**
 * Product category.
 */
export interface Category {
  id: string;
  name: string;
}

/**
 * Product brand.
 */
export interface Brand {
  id: string;
  name: string;
}

/**
 * Unit of measure (e.g., Kg, Carton, Unit).
 */
export interface Unit {
  id: string;
  name: string;
}

/**
 * Warehouse or storage location.
 */
export interface Warehouse {
  id: string;
  name: string;
  location?: string;
  isMain: boolean;
  color?: string;
}

/**
 * Line item in a Sale.
 */
export interface SaleItem {
  productId: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export type PaymentStatus = 'En attente' | 'Partiel' | 'Payé';
export type SaleStatus = 'En attente' | 'Complétée';
export type PaymentMethod = 'Espèces' | 'Virement bancaire' | 'Autre';

/**
 * Sale transaction record.
 */
export interface Sale {
  id: string;
  referenceNumber: string;
  customerId: string;
  warehouseId: string;
  date: string;
  items: SaleItem[];
  grandTotal: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  saleStatus: SaleStatus;
  paymentDueDate?: string;
  paymentDeadlineDays?: number;
}

/**
 * Record of a payment against a sale.
 */
export interface SalePayment {
  id: string;
  saleId: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  createdByUserId: string;
  attachmentUrl?: string;
}

/**
 * Line item in a Purchase.
 */
export interface PurchaseItem {
  productId: string;
  quantity: number;
  cost: number;
  subtotal: number;
}

export type PurchaseStatus = 'En attente' | 'Commandé' | 'Reçu';

/**
 * Purchase transaction record.
 */
export interface Purchase {
  id: string;
  referenceNumber: string;
  date: string;
  supplierId: string;
  warehouseId: string;
  items: PurchaseItem[];
  shippingCost: number;
  grandTotal: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  purchaseStatus: PurchaseStatus;
  notes?: string;
}

/**
 * Record of a payment against a purchase.
 */
export interface Payment {
  id: string;
  purchaseId: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  createdByUserId: string;
  attachmentUrl?: string;
}

/**
 * Manual stock correction record.
 */
export interface StockAdjustment {
  id: string;
  date: string;
  warehouseId: string;
  productId: string;
  type: 'addition' | 'subtraction';
  quantity: number;
  reason: string;
  createdByUserId: string;
}

/**
 * Stock movement between two warehouses.
 */
export interface WarehouseTransfer {
  id: string;
  date: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  productId: string;
  quantity: number;
  status: string;
}

/**
 * Generic order representation for simplified views.
 */
export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  createdAt: string;
  total: number;
  status: string;
  createdByUserId: string;
  warehouseId: string;
}

/**
 * Global application settings and company profile.
 */
export interface AppSettings {
  id: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail?: string;
  companyContact?: string;
  companyRCCM?: string;
  companyLogoUrl?: string;
  currencySymbol: string;
  invoiceFooterText: string;
  saleInvoicePrefix: string;
  purchaseInvoicePrefix: string;
  defaultTaxRate: number;
  defaultPosCustomerId: string;
  themeColor: string;
}
