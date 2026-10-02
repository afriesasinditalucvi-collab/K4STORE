import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Barcode,
  CheckCircle2,
  CreditCard,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { CartItem, Product, ProductCategory } from '../types';
import { Language, translations } from '../i18n/translations';
import { ProductImage } from './ProductImage';
import { formatIDR } from '../utils/exportReports';

interface PosCashierViewProps {
  products: Product[];
  cart: CartItem[];
  lang: Language;
  onAddToCart: (product: Product) => void;
  onUpdateCartQty: (productId: string, delta: number) => void;
  onClearCart: () => void;
  onOpenPayment: (checkoutData: {
    customerName: string;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
  }) => void;
}

const PROMO_CODES: Record<string, { type: 'pct' | 'flat'; value: number; label: string }> = {
  HEMAT10: { type: 'pct', value: 10, label: 'Diskon 10%' },
  MEMBER20: { type: 'pct', value: 20, label: 'Member 20%' },
  MURAH5K: { type: 'flat', value: 5000, label: 'Potongan Rp 5.000' },
};

export const PosCashierView: React.FC<PosCashierViewProps> = ({
  products,
  cart,
  lang,
  onAddToCart,
  onUpdateCartQty,
  onClearCart,
  onOpenPayment,
}) => {
  const t = translations[lang];
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategory>('all');
  const [customerName, setCustomerName] = useState<string>(t.posGuestDefault);
  const [promoInput, setPromoInput] = useState('');
  const [activePromo, setActivePromo] = useState<string | null>(null);
  const [applyTax, setApplyTax] = useState(true);

  const categories: { id: 'all' | ProductCategory; label: string }[] = [
    { id: 'all', label: t.catAll },
    { id: 'kopi_teh', label: t.cat_kopi_teh },
    { id: 'makanan_ringan', label: t.cat_makanan_ringan },
    { id: 'sembako', label: t.cat_sembako },
    { id: 'minuman', label: t.cat_minuman },
    { id: 'perawatan_diri', label: t.cat_perawatan_diri },
  ];

  // Helper to process a scanned/typed SKU and add product to cart
  const triggerSkuAdd = (matchedProduct: Product) => {
    const inCartQty =
      cart.find((c) => c.product.id === matchedProduct.id)?.quantity || 0;

    if (matchedProduct.stock <= 0 || inCartQty >= matchedProduct.stock) {
      setScanFeedback({
        type: 'error',
        message: `${t.posScanOut} ${matchedProduct.sku} (${matchedProduct.name})`,
      });
      return false;
    }

    onAddToCart(matchedProduct);
    setBarcodeInput('');
    setScanFeedback({
      type: 'success',
      message: `${t.posScanSuccess} ${matchedProduct.name} (${matchedProduct.sku})`,
    });
    barcodeInputRef.current?.focus();
    return true;
  };

  // Automatically search and add product to cart as soon as exact SKU is entered/scanned
  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setBarcodeInput(rawValue);

    const normalized = rawValue.trim().toUpperCase();
    if (!normalized) {
      setScanFeedback(null);
      return;
    }

    const exactSkuMatch = products.find(
      (p) => p.sku.toUpperCase() === normalized
    );
    if (exactSkuMatch) {
      triggerSkuAdd(exactSkuMatch);
    }
  };

  // Also allow pressing Enter or clicking Scan button for partial or exact SKU lookup
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = barcodeInput.trim().toUpperCase();
    if (!normalized) return;

    const exactMatch = products.find((p) => p.sku.toUpperCase() === normalized);
    if (exactMatch) {
      triggerSkuAdd(exactMatch);
      return;
    }

    const partialMatches = products.filter((p) =>
      p.sku.toUpperCase().includes(normalized)
    );
    if (partialMatches.length === 1) {
      triggerSkuAdd(partialMatches[0]);
      return;
    }

    setScanFeedback({
      type: 'error',
      message: `${t.posScanNotFound} ${normalized}`,
    });
  };

  // Live SKU suggestions while typing a partial SKU in the scanner field
  const skuSuggestions = barcodeInput.trim()
    ? products
        .filter((p) =>
          p.sku.toUpperCase().includes(barcodeInput.trim().toUpperCase())
        )
        .slice(0, 4)
    : [];

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const promoDef = activePromo ? PROMO_CODES[activePromo] : null;
  const discountAmount = promoDef
    ? promoDef.type === 'pct'
      ? Math.round((subtotal * promoDef.value) / 100)
      : Math.min(subtotal, promoDef.value)
    : 0;

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = applyTax ? Math.round(taxableAmount * 0.11) : 0;
  const totalAmount = taxableAmount + taxAmount;

  const handleApplyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (PROMO_CODES[code]) {
      setActivePromo(code);
    } else {
      setActivePromo(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 8 Columns: Barcode Scanner, Product Search, Category Filter & Catalog Grid */}
      <div className="lg:col-span-8 space-y-5">
        {/* Dedicated Barcode / SKU Scanner Bar + Catalog Search */}
        <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Automatic Barcode / SKU Scanner Input */}
            <form
              onSubmit={handleBarcodeSubmit}
              className="md:col-span-7 flex items-center gap-2"
            >
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={handleBarcodeChange}
                  placeholder={t.posBarcodePlaceholder}
                  aria-label={t.posBarcodeLabel}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {t.posQuickScan}
              </button>
            </form>

            {/* General Catalog Search Input */}
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.posSearchPlaceholder}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Live Matching SKU Suggestions (When typing partial SKU) */}
          {skuSuggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                SKU Cocok:
              </span>
              {skuSuggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => triggerSkuAdd(item)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-800 dark:text-slate-200 rounded-md transition-colors whitespace-nowrap"
                >
                  <span>{item.sku}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-sans truncate max-w-[160px]">{item.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Instant Scanner Feedback Line */}
          {scanFeedback && (
            <div
              className={`flex items-center justify-between gap-2 text-xs pt-1 ${
                scanFeedback.type === 'success'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              <div className="flex items-center gap-1.5 font-medium">
                {scanFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{scanFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setScanFeedback(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[11px]"
              >
                {t.close}
              </button>
            </div>
          )}
        </div>

        {/* Interactive Category Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProducts.map((product) => {
            const inCartQty =
              cart.find((c) => c.product.id === product.id)?.quantity || 0;
            const isOut = product.stock <= 0;
            const isLow = product.stock > 0 && product.stock <= product.minStock;

            return (
              <div
                key={product.id}
                onClick={() => {
                  if (!isOut) onAddToCart(product);
                }}
                className={`group border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between transition-transform duration-150 ${
                  isOut
                    ? 'opacity-60 cursor-not-allowed'
                    : 'cursor-pointer hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="aspect-4/3 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <ProductImage
                      imageKey={product.imageKey}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                    />
                  </div>
                  <div className="p-4">
                    {/* Clean unboxed metadata with typographic separator */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      <span>{product.sku}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          isOut
                            ? 'text-red-600 dark:text-red-400 font-semibold'
                            : isLow
                            ? 'text-amber-600 dark:text-amber-400 font-semibold'
                            : ''
                        }
                      >
                        {isOut
                          ? t.outOfStock
                          : `${t.remainingStock}: ${product.stock} ${product.unit}`}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-1 line-clamp-2">
                      {product.name}
                    </h3>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60">
                  <span className="text-sm font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                    {formatIDR(product.price)}
                  </span>
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {inCartQty > 0 ? `${inCartQty}x di keranjang` : `+ ${t.addToCart}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right 4 Columns: Contiguous POS Cart & Checkout Terminal */}
      <div className="lg:col-span-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 sticky top-20 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t.posCartTitle} ({cart.reduce((s, i) => s + i.quantity, 0)})
            </h2>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={onClearCart}
              className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.posClearCart}</span>
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Customer Name Input */}
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              {t.posCustomerLabel}
            </label>
            <input
              type="text"
              maxLength={80}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* Cart Items List */}
          {cart.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
              {t.posEmptyCart}
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 pr-1">
              {cart.map(({ product, quantity }) => (
                <div
                  key={product.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-slate-900 dark:text-white truncate">
                      {product.name}
                    </div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      {formatIDR(product.price)} × {quantity} ={' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {formatIDR(product.price * quantity)}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateCartQty(product.id, -1)}
                      className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      aria-label="Kurangi"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      disabled={quantity >= product.stock}
                      onClick={() => onUpdateCartQty(product.id, 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                      aria-label="Tambah"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Promo Voucher & Tax Controls */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder={t.posPromoPlaceholder}
                className="flex-1 px-3 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleApplyPromo}
                className="px-3 py-1.5 text-xs font-medium bg-slate-900 dark:bg-slate-800 text-white rounded-lg hover:bg-slate-800 whitespace-nowrap"
              >
                {t.posApplyPromo}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                {(['HEMAT10', 'MEMBER20'] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setPromoInput(code);
                      setActivePromo(code);
                    }}
                    className={`px-2 py-0.5 font-mono rounded border text-[11px] transition-colors ${
                      activePromo === code
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyTax}
                  onChange={(e) => setApplyTax(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>{t.posTaxToggle}</span>
              </label>
            </div>
          </div>

          {/* Totals Calculation */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{t.posSubtotal}</span>
              <span className="font-mono tabular-nums">{formatIDR(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>
                  {t.posDiscount} ({activePromo})
                </span>
                <span className="font-mono tabular-nums">-{formatIDR(discountAmount)}</span>
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
              onOpenPayment({
                customerName: customerName.trim() || t.posGuestDefault,
                subtotal,
                discountAmount,
                taxAmount,
                totalAmount,
              })
            }
            className="w-full flex items-center justify-center gap-2 py-3 px-4 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
          >
            <CreditCard className="w-4 h-4" />
            <span>{t.posPayNow}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
