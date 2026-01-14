
// FIX: Removed a self-referencing import of 'Role' that caused a conflict with the local interface declaration.
export interface Role {
  id: string;
  name: string;
  permissions: string[];
  warehouseIds?: string[];
}

export interface User {
  uid: string;
  username: string;
  displayName: string;
  password?: string;
  roleId: string;
  warehouseIds?: string[];
  role?: Role;
}

export interface Category {
  id: string;
  name: string;
}

export interface Brand {
  id: string;
  name: string;
}

export interface Unit {
  id: string;
  name: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  isMain: boolean;
  color?: string; // Propriété optionnelle pour la palette de couleur (ex: 'blue', 'green', etc.)
}

export interface StockLevel {
  warehouseId: string;
  quantity: number;
}

export interface Product {
  id: string;
  type: 'product' | 'service';
  name: string;
  sku: string;
  brandId?: string;
  unitId?: string;
  categoryId?: string;
  imageUrl?: string;
  description?: string;
  upc_ean?: string;
  cost: number;
  price: number;
  wholesalePrice?: number;
  taxRate?: number;
  taxInclusive?: boolean;
  minStockAlert: number;
  stockLevels: StockLevel[];
}

export interface BasePartner {
  id: string;
  name: string; // Nom de contact ou nom complet
  // FIX: Added contactPerson property to support supplier contact details used in forms and mock data.
  contactPerson?: string;
  email: string;
  phone: string;
  businessName?: string;
  address?: string;
  city?: string;
  nif?: string;
  rccm?: string;
  website?: string;
  notes?: string;
  isCreditLimited?: boolean;
  creditLimit?: number;
}

export interface Customer extends BasePartner {
  // Spécificités clients si besoin
}

export interface Supplier extends BasePartner {
  // Spécificités fournisseurs si besoin
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  createdAt: string; // ISO string
  total: number;
  status: 'Payée' | 'En attente' | 'Annulée';
  createdByUserId: string;
  warehouseId: string;
}

export interface WarehouseTransfer {
  id: string;
  date: string; // ISO string
  fromWarehouseId: string;
  toWarehouseId: string;
  productId: string;
  quantity: number;
  status: 'Complété' | 'En attente' | 'Annulé';
}

export interface StockAdjustment {
    id: string;
    date: string; // ISO String
    warehouseId: string;
    productId: string;
    type: 'addition' | 'subtraction';
    quantity: number;
    reason: string;
    createdByUserId: string;
}

export type PaymentMethod = 'Espèces' | 'Carte de crédit' | 'Virement bancaire' | 'Autre';
export type PaymentStatus = 'En attente' | 'Partiel' | 'Payé';
export type PurchaseStatus = 'En attente' | 'Commandé' | 'Reçu';

export interface PurchaseItem {
    productId: string;
    quantity: number;
    cost: number;
    subtotal: number;
}

export interface Purchase {
    id: string;
    referenceNumber: string;
    date: string; // ISO String
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

export interface Payment {
    id: string;
    purchaseId: string;
    date: string; // ISO String
    amount: number;
    method: PaymentMethod;
    createdByUserId: string;
    attachmentUrl?: string;
}

export interface SaleItem {
    productId: string;
    quantity: number;
    price: number;
    subtotal: number;
}
export interface Sale {
    id: string;
    referenceNumber: string;
    date: string;
    customerId: string;
    warehouseId: string;
    items: SaleItem[];
    grandTotal: number;
    paidAmount: number;
    paymentStatus: PaymentStatus;
    saleStatus: 'Complétée' | 'En attente';
    paymentDeadlineDays?: number;
    paymentDueDate?: string;
}

export interface SalePayment {
    id: string;
    saleId: string;
    date: string; // ISO String
    amount: number;
    method: PaymentMethod;
    createdByUserId: string;
    attachmentUrl?: string;
}

export interface AppSettings {
  id: string; // Should be a fixed ID like 'app-config'
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyContact?: string;
  companyRCCM?: string;
  companyLogoUrl?: string;
  currencySymbol: string;
  invoiceFooterText?: string;
  saleInvoicePrefix?: string;
  purchaseInvoicePrefix?: string;
  defaultTaxRate?: number;
  defaultPosCustomerId?: string;
  themeColor?: string;
}
