import React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  Plus,
  Receipt,
} from 'lucide-react';
import { Product, TransactionRecord } from '../types';
import { Language, translations } from '../i18n/translations';
import {
  exportSalesReportExcel,
  exportSalesReportPDF,
  formatDateTime,
  formatIDR,
} from '../utils/exportReports';

interface AnalyticsViewProps {
  products: Product[];
  transactions: TransactionRecord[];
  lang: Language;
  onQuickRestock: (product: Product, addedQty: number) => Promise<void>;
  onSelectReceipt: (tx: TransactionRecord) => void;
  onNavigateInventory: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  products,
  transactions,
  lang,
  onQuickRestock,
  onSelectReceipt,
  onNavigateInventory,
}) => {
  const t = translations[lang];

  const completedTx = transactions.filter((tx) => tx.status === 'completed');
  const totalRevenue = completedTx.reduce((sum, tx) => sum + tx.totalAmount, 0);
  const totalProfit = completedTx.reduce((sum, tx) => sum + tx.totalProfit, 0);
  const profitMarginPct =
    totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0';
  const averageOrderValue =
    completedTx.length > 0 ? Math.round(totalRevenue / completedTx.length) : 0;

  const lowStockProducts = products.filter((p) => p.stock <= p.minStock);

  // Build 7-day trend chart data
  const dayBuckets = [
    { label: '26 Sep', datePrefix: '2026-09-26' },
    { label: '27 Sep', datePrefix: '2026-09-27' },
    { label: '28 Sep', datePrefix: '2026-09-28' },
    { label: '29 Sep', datePrefix: '2026-09-29' },
    { label: '30 Sep', datePrefix: '2026-09-30' },
    { label: '01 Okt', datePrefix: '2026-10-01' },
    { label: 'Hari Ini', datePrefix: new Date().toISOString().slice(0, 10) },
  ];

  // Deduplicate if today is already 2026-10-01
  const uniqueBuckets = dayBuckets.filter(
    (b, idx, arr) => arr.findIndex((x) => x.datePrefix === b.datePrefix) === idx
  );

  const chartSeries = uniqueBuckets.map((b) => {
    const dayTx = completedTx.filter((tx) => tx.createdAt.startsWith(b.datePrefix));
    const rev = dayTx.reduce((s, x) => s + x.totalAmount, 0);
    const prof = dayTx.reduce((s, x) => s + x.totalProfit, 0);
    return {
      label: b.label,
      revenue: rev,
      profit: prof,
      count: dayTx.length,
    };
  });

  const maxRevenue = Math.max(...chartSeries.map((d) => d.revenue), 200000);

  // Payment method distribution
  const paymentCounts: Record<string, { amount: number; count: number; label: string }> = {
    qris: { amount: 0, count: 0, label: 'QRIS Dinamis' },
    ewallet: { amount: 0, count: 0, label: 'E-Wallet (GoPay/OVO)' },
    va_bank: { amount: 0, count: 0, label: 'Virtual Account Bank' },
    card: { amount: 0, count: 0, label: 'Kartu EDC Contactless' },
    cash: { amount: 0, count: 0, label: 'Tunai (Cash)' },
  };

  completedTx.forEach((tx) => {
    const bucket = paymentCounts[tx.paymentMethod] || paymentCounts.qris;
    bucket.amount += tx.totalAmount;
    bucket.count += 1;
  });

  return (
    <div className="space-y-8">
      {/* Header & Quick Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
            {t.dashboardTitle}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {t.dashboardSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => exportSalesReportPDF(completedTx, lang)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.exportSalesPdf}</span>
          </button>
          <button
            type="button"
            onClick={() => exportSalesReportExcel(completedTx, lang)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t.exportSalesExcel}</span>
          </button>
        </div>
      </div>

      {/* Automated Low-Stock Alert Banner (Only when items are low/out of stock) */}
      {lowStockProducts.length > 0 && (
        <div className="border border-amber-300 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t.lowStockAlertTitle} ({lowStockProducts.length} SKU)
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {lowStockProducts.length} {t.lowStockAlertDesc}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onNavigateInventory}
              className="self-start lg:self-auto flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline whitespace-nowrap"
            >
              <span>{t.navInventory}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-amber-200/80 dark:border-amber-800/60 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-4 font-medium">{t.invColSku}</th>
                  <th className="py-2 pr-4 font-medium">{t.invColProduct}</th>
                  <th className="py-2 pr-4 font-medium text-right">{t.invColStock}</th>
                  <th className="py-2 pr-4 font-medium text-right">{t.invColMinStock}</th>
                  <th className="py-2 font-medium text-right">{t.invColActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200/50 dark:divide-amber-900/40 text-xs">
                {lowStockProducts.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 pr-4 font-mono text-slate-600 dark:text-slate-400">
                      {item.sku}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-slate-100">
                      {item.name}
                    </td>
                    <td className="py-2.5 pr-4 font-mono font-semibold text-right text-red-600 dark:text-red-400 tabular-nums">
                      {item.stock} {item.unit}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-right text-slate-600 dark:text-slate-400 tabular-nums">
                      {item.minStock} {item.unit}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onQuickRestock(item, 15)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-md transition-colors whitespace-nowrap"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{t.addStock15}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4-Column KPI Grid (Single-Elevation Depth, Tabular Figures) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t.kpiRevenue}</div>
          <div className="text-2xl font-mono font-semibold text-slate-900 dark:text-white mt-2 tabular-nums">
            {formatIDR(totalRevenue)}
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5">
            {completedTx.length} transaksi selesai · Real-time
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t.kpiProfit}</div>
          <div className="text-2xl font-mono font-semibold text-slate-900 dark:text-white mt-2 tabular-nums">
            {formatIDR(totalProfit)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono tabular-nums">
            {t.kpiMargin}: {profitMarginPct}%
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t.kpiTransactions}</div>
          <div className="text-2xl font-mono font-semibold text-slate-900 dark:text-white mt-2 tabular-nums">
            {completedTx.length}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono tabular-nums">
            {t.kpiAov}: {formatIDR(averageOrderValue)}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t.kpiLowStock}</div>
          <div
            className={`text-2xl font-mono font-semibold mt-2 tabular-nums ${
              lowStockProducts.length > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {lowStockProducts.length} / {products.length} SKU
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            {lowStockProducts.length > 0 ? t.kpiNeedsRestock : t.allStockHealthy}
          </div>
        </div>
      </div>

      {/* Main Analytics Split: 7-Day Revenue Bar Chart + Payment Method Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue & Profit Chart */}
        <div className="lg:col-span-8 p-6 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {t.revenueChartTitle}
            </h2>
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-900 dark:bg-emerald-500 inline-block" />
                <span>Omzet</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500/50 dark:bg-slate-600 inline-block" />
                <span>Laba Kotor</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-7 gap-3 items-end h-52 pt-4 border-b border-slate-200 dark:border-slate-800">
            {chartSeries.map((point) => {
              const revHeightPct = Math.max(8, Math.round((point.revenue / maxRevenue) * 100));
              const profHeightPct = Math.max(4, Math.round((point.profit / maxRevenue) * 100));
              return (
                <div
                  key={point.label}
                  className="flex flex-col items-center justify-end h-full group"
                >
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1.5 tabular-nums">
                    {point.revenue > 0 ? `${Math.round(point.revenue / 1000)}k` : '0'}
                  </div>
                  <div className="w-full max-w-[42px] flex items-end justify-center gap-1 h-36">
                    <div
                      style={{ height: `${revHeightPct}%` }}
                      className="w-1/2 bg-slate-900 dark:bg-emerald-500 rounded-t-xs transition-transform duration-150"
                      title={`Omzet: ${formatIDR(point.revenue)}`}
                    />
                    <div
                      style={{ height: `${profHeightPct}%` }}
                      className="w-1/2 bg-emerald-500/50 dark:bg-slate-600 rounded-t-xs transition-transform duration-150"
                      title={`Laba: ${formatIDR(point.profit)}`}
                    />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 py-2 font-mono">
                    {point.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Digital & Cash Payment Distribution */}
        <div className="lg:col-span-4 p-6 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-5">
              {t.paymentMixTitle}
            </h2>
            <div className="space-y-4">
              {Object.entries(paymentCounts).map(([key, info]) => {
                const sharePct =
                  totalRevenue > 0 ? Math.round((info.amount / totalRevenue) * 100) : 0;
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {info.label}
                      </span>
                      <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        {info.count}x · {formatIDR(info.amount)} ({sharePct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.max(sharePct, info.count > 0 ? 6 : 0)}%` }}
                        className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 mt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Integrasi Pembayaran Aktif</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">
              QRIS · VA · E-Wallet · Tunai
            </span>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {t.recentTransactionsTitle}
          </h2>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {completedTx.length} transaksi
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950/40">
                <th className="py-3 px-4 font-medium">{t.colInvoice}</th>
                <th className="py-3 px-4 font-medium">{t.colDate}</th>
                <th className="py-3 px-4 font-medium">{t.colCustomer}</th>
                <th className="py-3 px-4 font-medium">{t.colItems}</th>
                <th className="py-3 px-4 font-medium">{t.colPayment}</th>
                <th className="py-3 px-4 font-medium text-right">{t.colTotal}</th>
                <th className="py-3 px-4 font-medium text-right">{t.colReceipt}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {completedTx.slice(0, 8).map((tx) => (
                <tr
                  key={tx.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {tx.invoiceNumber}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {formatDateTime(tx.createdAt, lang)}
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {tx.customerName} ·{' '}
                    <span className="text-slate-500">
                      {tx.orderType === 'pos_cashier' ? t.channelPos : t.channelSelf}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                    {tx.itemsSummary}
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {tx.paymentProvider}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-right text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                    {formatIDR(tx.totalAmount)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onSelectReceipt(tx)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 rounded-md transition-colors"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>{t.colReceipt}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
