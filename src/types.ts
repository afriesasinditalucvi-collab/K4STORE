export type ProductCategory =
  | 'kopi_teh'
  | 'makanan_ringan'
  | 'sembako'
  | 'minuman'
  | 'kebutuhan_rumah'
  | 'perawatan_diri';

export type PaymentMethodType = 'qris' | 'ewallet' | 'va_bank' | 'cash' | 'card';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  imageKey: string;
  supplier: string;
  visibility: 'public' | 'archived';
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface TransactionRecord {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  cashierName: string;
  orderType: 'pos_cashier' | 'customer_self_order';
  itemsSummary: string;
  totalItems: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  totalProfit: number;
  paymentMethod: PaymentMethodType;
  paymentProvider: string;
  paymentReference: string;
  amountPaid: number;
  changeAmount: number;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  storeScope: 'K4 Store_global';
  createdAt: string;
  updatedAt: string;
}

export type AppView = 'dashboard' | 'pos' | 'inventory' | 'reports' | 'storefront';

export type UserRoleMode = 'admin' | 'customer' | 'guest';
