import React from 'react';
import { CheckCircle2, Download, Printer, X } from 'lucide-react';
import { TransactionRecord } from '../types';
import { Language, translations } from '../i18n/translations';
import { exportReceiptPDF, formatDateTime, formatIDR } from '../utils/exportReports';

interface ReceiptModalProps {
  transaction: TransactionRecord | null;
  lang: Language;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  transaction,
  lang,
  onClose,
}) => {
  if (!transaction) return null;
  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.receiptTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg"
            aria-label={t.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div id="printable-receipt" className="p-6 space-y-4 text-sm">
          <div className="text-center border-b border-dashed border-slate-200 dark:border-slate-800 pb-4">
            <div className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              K4 Store Minimarket
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Jl. Sudirman Niaga No. 88, Jakarta · NPWP 01.339.882.1-091.000
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 border-b border-dashed border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex justify-between">
              <span>{t.colInvoice}</span>
              <span className="font-mono font-medium text-slate-900 dark:text-slate-200">
                {transaction.invoiceNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{t.colDate}</span>
              <span className="font-mono">
                {formatDateTime(transaction.createdAt, lang)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{t.colCustomer}</span>
              <span className="text-slate-900 dark:text-slate-200">
                {transaction.customerName}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{t.colChannel}</span>
              <span>{transaction.cashierName}</span>
            </div>
          </div>

          <div className="border-b border-dashed border-slate-200 dark:border-slate-800 pb-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              {t.colItems} ({transaction.totalItems} item)
            </div>
            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
              {transaction.itemsSummary}
            </p>
          </div>

          <div className="space-y-1.5 text-xs border-b border-dashed border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{t.posSubtotal}</span>
              <span className="font-mono tabular-nums">
                {formatIDR(transaction.subtotal)}
              </span>
            </div>
            {transaction.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>{t.posDiscount}</span>
                <span className="font-mono tabular-nums">
                  -{formatIDR(transaction.discountAmount)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{t.posTax}</span>
              <span className="font-mono tabular-nums">
                {formatIDR(transaction.taxAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-slate-900 dark:text-white pt-1">
              <span>{t.posTotal}</span>
              <span className="font-mono tabular-nums">
                {formatIDR(transaction.totalAmount)}
              </span>
            </div>
          </div>

          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>{t.colPayment}</span>
              <span className="font-medium text-slate-900 dark:text-slate-200">
                {transaction.paymentProvider}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Ref ID</span>
              <span className="font-mono">{transaction.paymentReference}</span>
            </div>
            <div className="flex justify-between">
              <span>Nominal Bayar</span>
              <span className="font-mono tabular-nums">
                {formatIDR(transaction.amountPaid)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{t.cashChangeLabel}</span>
              <span className="font-mono tabular-nums">
                {formatIDR(transaction.changeAmount)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t.printReceipt}</span>
          </button>
          <button
            type="button"
            onClick={() => exportReceiptPDF(transaction, lang)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.downloadReceiptPdf}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
