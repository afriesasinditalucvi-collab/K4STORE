import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { Product, ProductCategory, TransactionRecord } from '../types';
import { Language, translations } from '../i18n/translations';
import {
  exportInventoryReportExcel,
  exportInventoryReportPDF,
  formatIDR,
} from '../utils/exportReports';
import { PRODUCT_CONSTRAINTS, sanitizeSku } from '../firebase';
import { ProductImage } from './ProductImage';
import { GoogleSheetsPanel } from './GoogleSheetsPanel';

interface InventoryViewProps {
  products: Product[];
  transactions: TransactionRecord[];
  accessToken: string | null;
  lang: Language;
  onSaveProduct: (
    productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onQuickRestock: (product: Product, addedQty: number) => Promise<void>;
  onConnectGoogleWorkspace: () => Promise<void>;
  onImportProductsFromSheet: (
    imported: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>[]
  ) => Promise<void>;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  transactions,
  accessToken,
  lang,
  onSaveProduct,
  onDeleteProduct,
  onQuickRestock,
  onConnectGoogleWorkspace,
  onImportProductsFromSheet,
}) => {
  const t = translations[lang];
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProductCategory>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSheetsSync, setShowSheetsSync] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form state synced with firebase-blueprint.json constraints
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('kopi_teh');
  const [costPrice, setCostPrice] = useState('10000');
  const [price, setPrice] = useState('15000');
  const [stock, setStock] = useState('25');
  const [minStock, setMinStock] = useState('10');
  const [unit, setUnit] = useState('pcs');
  const [supplier, setSupplier] = useState('PT Distribusi Nusantara');
  const [imageKey, setImageKey] = useState('coffee_series');
  const [isSaving, setIsSaving] = useState(false);

  const openAddModal = () => {
    setEditingProduct(null);
    setSku(`K4S-PRD-${Math.floor(100 + Math.random() * 900)}`);
    setName('');
    setCategory('kopi_teh');
    setCostPrice('12000');
    setPrice('18000');
    setStock('30');
    setMinStock('10');
    setUnit('pcs');
    setSupplier('PT Distribusi Nusantara');
    setImageKey('coffee_series');
    setIsModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setSku(prod.sku);
    setName(prod.name);
    setCategory(prod.category);
    setCostPrice(String(prod.costPrice));
    setPrice(String(prod.price));
    setStock(String(prod.stock));
    setMinStock(String(prod.minStock));
    setUnit(prod.unit);
    setSupplier(prod.supplier);
    setImageKey(prod.imageKey);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveProduct(
        {
          sku: sanitizeSku(sku),
          name: name.trim().slice(0, PRODUCT_CONSTRAINTS.nameMax),
          category,
          costPrice: Math.max(0, Number(costPrice) || 0),
          price: Math.max(0, Number(price) || 0),
          stock: Math.max(0, Math.floor(Number(stock) || 0)),
          minStock: Math.max(0, Math.floor(Number(minStock) || 0)),
          unit: unit.trim().slice(0, PRODUCT_CONSTRAINTS.unitMax) || 'pcs',
          supplier:
            supplier.trim().slice(0, PRODUCT_CONSTRAINTS.supplierMax) ||
            'PT Distribusi Nusantara',
          imageKey,
          visibility: 'public',
        },
        editingProduct?.id
      );
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.supplier.toLowerCase().includes(q);
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    const matchesStock =
      stockFilter === 'all'
        ? true
        : stockFilter === 'out'
        ? p.stock === 0
        : p.stock <= p.minStock;
    return matchesSearch && matchesCategory && matchesStock;
  });

  const totalCostValuation = products.reduce(
    (sum, p) => sum + p.stock * p.costPrice,
    0
  );
  const totalRetailValuation = products.reduce(
    (sum, p) => sum + p.stock * p.price,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header & Export / Add Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
            {t.invTitle}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {t.invSubtitle} · Nilai Modal:{' '}
            <span className="font-mono font-medium text-slate-900 dark:text-slate-200">
              {formatIDR(totalCostValuation)}
            </span>{' '}
            · Nilai Jual:{' '}
            <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
              {formatIDR(totalRetailValuation)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSheetsSync((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              showSheetsSync
                ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Google Sheets Sync</span>
          </button>
          <button
            type="button"
            onClick={() => exportInventoryReportPDF(products, lang)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.exportInvPdf}</span>
          </button>
          <button
            type="button"
            onClick={() => exportInventoryReportExcel(products)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t.exportInvExcel}</span>
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{t.invAddProduct}</span>
          </button>
        </div>
      </div>

      {/* Expandable Google Sheets Live Sync Panel in Inventory */}
      {showSheetsSync && (
        <GoogleSheetsPanel
          products={products}
          transactions={transactions}
          accessToken={accessToken}
          lang={lang}
          onConnectGoogleWorkspace={onConnectGoogleWorkspace}
          onImportProductsFromSheet={onImportProductsFromSheet}
        />
      )}

      {/* Search & Interactive Filter Controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.invSearchPlaceholder}
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Stock Status Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
            {[
              { id: 'all' as const, label: `${t.invFilterAll} (${products.length})` },
              {
                id: 'low' as const,
                label: `${t.invFilterLow} (${
                  products.filter((p) => p.stock <= p.minStock).length
                })`,
              },
              {
                id: 'out' as const,
                label: `${t.invFilterOut} (${
                  products.filter((p) => p.stock === 0).length
                })`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStockFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  stockFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | ProductCategory)}
            className="px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200"
          >
            <option value="all">{t.catAll}</option>
            <option value="kopi_teh">{t.cat_kopi_teh}</option>
            <option value="makanan_ringan">{t.cat_makanan_ringan}</option>
            <option value="sembako">{t.cat_sembako}</option>
            <option value="minuman">{t.cat_minuman}</option>
            <option value="perawatan_diri">{t.cat_perawatan_diri}</option>
          </select>
        </div>
      </div>

      {/* High-Density Inventory Data Grid */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950/40">
                <th className="py-3 px-4 font-medium">{t.invColSku}</th>
                <th className="py-3 px-4 font-medium">{t.invColProduct}</th>
                <th className="py-3 px-4 font-medium text-right">{t.invColCost}</th>
                <th className="py-3 px-4 font-medium text-right">{t.invColPrice}</th>
                <th className="py-3 px-4 font-medium text-right">{t.invColStock}</th>
                <th className="py-3 px-4 font-medium text-right">{t.invColMinStock}</th>
                <th className="py-3 px-4 font-medium">{t.invColStatus}</th>
                <th className="py-3 px-4 font-medium text-right">{t.invColActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredProducts.map((product) => {
                const isOut = product.stock === 0;
                const isLow = product.stock > 0 && product.stock <= product.minStock;

                return (
                  <tr
                    key={product.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {product.sku}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                          <ProductImage
                            imageKey={product.imageKey}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {product.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {product.category} · {product.supplier}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-right text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                      {formatIDR(product.costPrice)}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-right text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                      {formatIDR(product.price)}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-right text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                      {product.stock} {product.unit}
                    </td>
                    <td className="py-3 px-4 font-mono text-right text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                      {product.minStock} {product.unit}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {/* Unboxed semantic status with icon + explicit text label */}
                      {isOut ? (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{t.statusOut}</span>
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{t.statusLow}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{t.statusNormal}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onQuickRestock(product, 10)}
                          className="px-2 py-1 text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-700 dark:text-slate-300 rounded transition-colors"
                          title={t.restockTitle}
                        >
                          +10
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(product)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded transition-colors"
                          title={t.invEditProduct}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteProduct(product.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                          title={t.delete}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {editingProduct ? t.invEditProduct : t.invAddProduct}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.invColSku}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingProduct)}
                    maxLength={PRODUCT_CONSTRAINTS.skuMax}
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.invColCategory}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ProductCategory)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="kopi_teh">{t.cat_kopi_teh}</option>
                    <option value="makanan_ringan">{t.cat_makanan_ringan}</option>
                    <option value="sembako">{t.cat_sembako}</option>
                    <option value="minuman">{t.cat_minuman}</option>
                    <option value="perawatan_diri">{t.cat_perawatan_diri}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t.invColProduct}
                </label>
                <input
                  type="text"
                  required
                  minLength={PRODUCT_CONSTRAINTS.nameMin}
                  maxLength={PRODUCT_CONSTRAINTS.nameMax}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Kopi Susu Gula Aren 250ml"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.invColCost} (IDR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.invColPrice} (IDR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.invColStock}
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.invColMinStock}
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Satuan
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={PRODUCT_CONSTRAINTS.unitMax}
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Pemasok / Supplier
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={PRODUCT_CONSTRAINTS.supplierMax}
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Visual Kategori
                  </label>
                  <select
                    value={imageKey}
                    onChange={(e) => setImageKey(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="coffee_series">Kopi & Minuman Botol</option>
                    <option value="artisan_snacks">Makanan Ringan & Biskuit</option>
                    <option value="daily_essentials">Sembako & Kebutuhan Harian</option>
                    <option value="fresh_beverages">Minuman Segar & Susu</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  {t.saveProduct}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
