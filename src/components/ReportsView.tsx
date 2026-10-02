import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Receipt,
  Search,
} from 'lucide-react';
import { PaymentMethodType, Product, TransactionRecord } from '../types';
import { Language, translations } from '../i18n/translations';
import {
  exportInventoryReportExcel,
  exportInventoryReportPDF,
  exportSalesReportExcel,
  exportSalesReportPDF,
  formatDateTime,
  formatIDR,
} from '../utils/exportReports';
import { GoogleSheetsPanel } from './GoogleSheetsPanel';

interface ReportsViewProps {
  products: Product[];
  transactions: TransactionRecord[];
  accessToken: string | null;
  lang: Language;
  onSelectReceipt: (tx: TransactionRecord) => void;
  onConnectGoogleWorkspace: () => Promise<void>;
  onImportProductsFromSheet: (
    imported: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>[]
  ) => Promise<void>;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  products,
  transactions,
  accessToken,
  lang,
  onSelectReceipt,
  onConnectGoogleWorkspace,
  onImportProductsFromSheet,
}) => {
  const t = translations[lang];
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethodType>('all');

  const filteredTx = transactions.filter((tx) => {
    const matchesMethod = methodFilter === 'all' || tx.paymentMethod === methodFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      tx.invoiceNumber.toLowerCase().includes(q) ||
      tx.customerName.toLowerCase().includes(q) ||
      tx.itemsSummary.toLowerCase().includes(q) ||
      tx.paymentProvider.toLowerCase().includes(q);
    return matchesMethod && matchesSearch;
  });

  const filteredRevenue = filteredTx.reduce((s, x) => s + x.totalAmount, 0);
  const filteredProfit = filteredTx.reduce((s, x) => s + x.totalProfit, 0);

  return (
    <div className="space-y-6">
      {/* Header & Export Hub */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
            {t.repTitle}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {t.repSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportSalesReportPDF(filteredTx, lang)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.exportSalesPdf}</span>
          </button>
          <button
            type="button"
            onClick={() => exportSalesReportExcel(filteredTx, lang)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t.exportSalesExcel}</span>
          </button>
          <button
            type="button"
            onClick={() => exportInventoryReportPDF(products, lang)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.exportInvPdf}</span>
          </button>
          <button
            type="button"
            onClick={() => exportInventoryReportExcel(products)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t.exportInvExcel}</span>
          </button>
        </div>
      </div>

      {/* Google Sheets & Google Drive Live Sync Hub */}
      <GoogleSheetsPanel
        products={products}
        transactions={transactions}
        accessToken={accessToken}
        lang={lang}
        onConnectGoogleWorkspace={onConnectGoogleWorkspace}
        onImportProductsFromSheet={onImportProductsFromSheet}
      />

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nomor invoice, nama pelanggan, atau produk..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg overflow-x-auto">
          {[
            { id: 'all' as const, label: t.filterAllMethods },
            { id: 'qris' as const, label: 'QRIS' },
            { id: 'ewallet' as const, label: 'E-Wallet' },
            { id: 'va_bank' as const, label: 'Virtual Account' },
            { id: 'card' as const, label: 'EDC Card' },
            { id: 'cash' as const, label: 'Tunai' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethodFilter(m.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                methodFilter === m.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtered Summary Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-xs">
        <div className="text-slate-600 dark:text-slate-400">
          Menampilkan <strong className="font-mono text-slate-900 dark:text-white">{filteredTx.length}</strong> transaksi
        </div>
        <div className="flex items-center gap-6 font-mono tabular-nums">
          <span>
            {t.kpiRevenue}:{' '}
            <strong className="text-slate-900 dark:text-white">
              {formatIDR(filteredRevenue)}
            </strong>
          </span>
          <span>
            {t.kpiProfit}:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {formatIDR(filteredProfit)}
            </strong>
          </span>
        </div>
      </div>

      {/* Full Transaction Ledger */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
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
                <th className="py-3 px-4 font-medium text-right">{t.colProfit}</th>
                <th className="py-3 px-4 font-medium text-right">{t.colReceipt}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredTx.map((tx) => (
                <tr
                  key={tx.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-white whitespace-nowrap">
                    {tx.invoiceNumber}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {formatDateTime(tx.createdAt, lang)}
                  </td>
                  <td className="py-3 px-4 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {tx.customerName}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-md truncate">
                    {tx.itemsSummary}
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {tx.paymentProvider} ·{' '}
                    <span className="font-mono text-slate-500">{tx.paymentReference}</span>
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-right text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                    {formatIDR(tx.totalAmount)}
                  </td>
                  <td className="py-3 px-4 font-mono text-right text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                    +{formatIDR(tx.totalProfit)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onSelectReceipt(tx)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-emerald-600 border border-slate-200 dark:border-slate-700 rounded-md"
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
