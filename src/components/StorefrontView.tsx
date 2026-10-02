import React, { useState } from 'react';
import {
  Minus,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  UserCheck,
} from 'lucide-react';
import { CartItem, Product, ProductCategory, TransactionRecord, UserRoleMode } from '../types';
import { Language, translations } from '../i18n/translations';
import { ProductImage } from './ProductImage';
import { formatDateTime, formatIDR } from '../utils/exportReports';

interface StorefrontViewProps {
  products: Product[];
  cart: CartItem[];
  transactions: TransactionRecord[];
  roleMode: UserRoleMode;
  userDisplayName: string;
  lang: Language;
  onAddToCart: (product: Product) => void;
  onUpdateCartQty: (productId: string, delta: number) => void;
  onOpenSelfCheckout: (checkoutData: {
    customerName: string;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
  }) => void;
  onSelectReceipt: (tx: TransactionRecord) => void;
  onLoginCustomer: () => void;
}

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  products,
  cart,
  transactions,
  roleMode,
  userDisplayName,
  lang,
  onAddToCart,
  onUpdateCartQty,
  onOpenSelfCheckout,
  onSelectReceipt,
  onLoginCustomer,
}) => {
  const t = translations[lang];
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [guestName, setGuestName] = useState(
    userDisplayName || (lang === 'id' ? 'Pelanggan Tamu' : 'Guest Shopper')
  );

  const categories: { id: 'all' | ProductCategory; label: string }[] = [
    { id: 'all', label: t.catAll },
    { id: 'kopi_teh', label: t.cat_kopi_teh },
    { id: 'makanan_ringan', label: t.cat_makanan_ringan },
    { id: 'sembako', label: t.cat_sembako },
    { id: 'minuman', label: t.cat_minuman },
    { id: 'perawatan_diri', label: t.cat_perawatan_diri },
  ];

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  // Automatic 5% member discount when logged in as customer/admin
  const memberDiscount = roleMode !== 'guest' ? Math.round(subtotal * 0.05) : 0;
  const taxable = Math.max(0, subtotal - memberDiscount);
  const taxAmount = Math.round(taxable * 0.11);
  const totalAmount = taxable + taxAmount;

  return (
    <div className="space-y-10">
      {/* Section 1: Storefront Hero with 16:9 Generated Visual & Measured Scrim */}
      <section className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900">
        <div className="aspect-21/9 sm:aspect-16/7 w-full relative">
          <ProductImage
            imageKey="hero_storefront"
            alt="K4 Store Minimarket Interior"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15" />

          <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10 max-w-3xl">
            <div className="text-xs font-medium text-emerald-300 tracking-wide mb-2">
              {t.heroEyebrow} · {roleMode === 'guest' ? t.roleGuest : t.roleCustomer}
            </div>
            <h1 className="font-display text-2xl sm:text-4xl font-semibold text-white tracking-tight">
              {t.heroTitle}
            </h1>
            <p className="text-sm sm:text-base text-slate-200 mt-2.5 max-w-2xl leading-relaxed">
              {t.heroDesc}
            </p>
          </div>
        </div>

        {/* Guest Mode / Member Info Strip */}
        <div className="px-6 py-3.5 bg-slate-950 text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-t border-slate-800">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {roleMode === 'guest'
                ? t.guestBannerDesc
                : `Login aktif sebagai ${userDisplayName} — Diskon Member 5% otomatis aktif pada keranjang belanja Anda.`}
            </span>
          </div>
          {roleMode === 'guest' && (
            <button
              type="button"
              onClick={onLoginCustomer}
              className="self-start sm:self-auto px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors whitespace-nowrap"
            >
              {t.loginAsCustomer} (Diskon 5%)
            </button>
          )}
        </div>
      </section>

      {/* Section 2: Featured Catalog & Self-Checkout Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* Search & Category Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.posSearchPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* 3-Column Retail Product Grid (1_ecommerce_retail.md rules) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const inCart = cart.find((c) => c.product.id === product.id);
              const isOut = product.stock <= 0;

              return (
                <div
                  key={product.id}
                  className="group border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
                >
                  <div>
                    <div className="aspect-4/3 w-full bg-[#F9F9F8] dark:bg-[#18181B] overflow-hidden">
                      <ProductImage
                        imageKey={product.imageKey}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                      />
                    </div>

                    <div className="p-4">
                      {/* Clean unboxed metadata: Category · Stock */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span className="uppercase tracking-wider">{product.category.replace('_', ' ')}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {isOut ? t.outOfStock : `${product.stock} ${product.unit}`}
                        </span>
                      </div>

                      <h3 className="text-base font-semibold text-slate-900 dark:text-white mt-1 line-clamp-2">
                        {product.name}
                      </h3>

                      <div className="text-[15px] font-mono font-semibold text-slate-900 dark:text-slate-100 mt-2 tabular-nums">
                        {formatIDR(product.price)}
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-4">
                    {inCart ? (
                      <div className="flex items-center justify-between border border-emerald-600 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => onUpdateCartQty(product.id, -1)}
                          className="w-8 h-8 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-md"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                          {inCart.quantity} {product.unit}
                        </span>
                        <button
                          type="button"
                          disabled={inCart.quantity >= product.stock}
                          onClick={() => onUpdateCartQty(product.id, 1)}
                          className="w-8 h-8 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-md disabled:opacity-40"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isOut}
                        onClick={() => onAddToCart(product)}
                        className="w-full py-2 px-4 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
                      >
                        {isOut ? t.outOfStock : t.addToCart}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 4 Columns: Self-Checkout Cart & Recent Orders */}
        <div className="lg:col-span-4 space-y-6 sticky top-20">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Keranjang Belanja ({cart.reduce((s, i) => s + i.quantity, 0)})
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {roleMode === 'guest' ? t.roleGuest : t.roleCustomer}
              </span>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {t.posCustomerLabel}
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              {cart.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  Pilih produk untuk mulai belanja mandiri.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-64 overflow-y-auto">
                  {cart.map(({ product, quantity }) => (
                    <div
                      key={product.id}
                      className="py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-900 dark:text-white truncate">
                          {product.name}
                        </div>
                        <div className="font-mono text-slate-500 tabular-nums">
                          {quantity} × {formatIDR(product.price)}
                        </div>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                        {formatIDR(product.price * quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{t.posSubtotal}</span>
                  <span className="font-mono tabular-nums">{formatIDR(subtotal)}</span>
                </div>
                {memberDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Diskon Member (5%)</span>
                    <span className="font-mono tabular-nums">
                      -{formatIDR(memberDiscount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{t.posTax}</span>
                  <span className="font-mono tabular-nums">{formatIDR(taxAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span>{t.posTotal}</span>
                  <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatIDR(totalAmount)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() =>
                  onOpenSelfCheckout({
                    customerName: guestName.trim() || 'Pelanggan Mandiri',
                    subtotal,
                    discountAmount: memberDiscount,
                    taxAmount,
                    totalAmount,
                  })
                }
                className="w-full py-3 px-4 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
              >
                {t.selfCheckoutBtn} (QRIS / E-Wallet / Tunai)
              </button>
            </div>
          </div>

          {/* Customer Recent Self-Orders */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
              {t.viewOrderHistory}
            </h3>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {transactions.slice(0, 3).map((tx) => (
                <div
                  key={tx.id}
                  className="py-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-mono font-medium text-slate-900 dark:text-white">
                      {tx.invoiceNumber}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatDateTime(tx.createdAt, lang)} · {formatIDR(tx.totalAmount)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectReceipt(tx)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Receipt className="w-3 h-3" />
                    <span>{t.colReceipt}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
