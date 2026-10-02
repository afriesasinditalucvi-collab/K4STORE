import React, { useState } from 'react';
import {
  QrCode,
  Wallet,
  Building2,
  CreditCard,
  Banknote,
  CheckCircle2,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { PaymentMethodType } from '../types';
import { Language, translations } from '../i18n/translations';
import { formatIDR } from '../utils/exportReports';

interface PaymentModalProps {
  isOpen: boolean;
  totalAmount: number;
  customerName: string;
  lang: Language;
  onClose: () => void;
  onCompletePayment: (details: {
    paymentMethod: PaymentMethodType;
    paymentProvider: string;
    paymentReference: string;
    amountPaid: number;
    changeAmount: number;
  }) => Promise<void>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  totalAmount,
  customerName,
  lang,
  onClose,
  onCompletePayment,
}) => {
  const t = translations[lang];
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('qris');
  const [ewalletProvider, setEwalletProvider] = useState<'GoPay' | 'OVO' | 'DANA' | 'ShopeePay'>('GoPay');
  const [bankProvider, setBankProvider] = useState<'BCA' | 'Mandiri' | 'BNI' | 'BRI'>('BCA');
  const [cardProvider, setCardProvider] = useState<'Debit BCA' | 'Visa Contactless' | 'Mastercard'>('Debit BCA');
  const [cashInput, setCashInput] = useState<string>(String(totalAmount));
  const [copiedVa, setCopiedVa] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const parsedCash = Math.max(0, Number(cashInput.replace(/[^0-9]/g, '')) || 0);
  const cashChange = Math.max(0, parsedCash - totalAmount);
  const isCashValid = selectedMethod !== 'cash' || parsedCash >= totalAmount;

  const generatedVaNumber =
    bankProvider === 'BCA'
      ? '880120269918273'
      : bankProvider === 'Mandiri'
      ? '890220269918273'
      : bankProvider === 'BNI'
      ? '827720269918273'
      : '888120269918273';

  const handleCopyVa = () => {
    navigator.clipboard?.writeText(generatedVaNumber);
    setCopiedVa(true);
    setTimeout(() => setCopiedVa(false), 1800);
  };

  const handleConfirm = async () => {
    if (!isCashValid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const refSuffix = Date.now().toString().slice(-8);
      let paymentProvider = 'QRIS Nasional';
      let paymentReference = `QRIS-${refSuffix}`;
      let amountPaid = totalAmount;
      let changeAmount = 0;

      if (selectedMethod === 'qris') {
        paymentProvider = 'QRIS Dinamis Nasional';
        paymentReference = `QRIS-${refSuffix}`;
      } else if (selectedMethod === 'ewallet') {
        paymentProvider = `${ewalletProvider} Instant`;
        paymentReference = `EWAL-${refSuffix}`;
      } else if (selectedMethod === 'va_bank') {
        paymentProvider = `${bankProvider} Virtual Account`;
        paymentReference = `VA-${refSuffix}`;
      } else if (selectedMethod === 'card') {
        paymentProvider = `EDC ${cardProvider}`;
        paymentReference = `EDC-${refSuffix}`;
      } else if (selectedMethod === 'cash') {
        paymentProvider = lang === 'id' ? 'Tunai Kasir' : 'Cash Tender';
        paymentReference = `CASH-${refSuffix}`;
        amountPaid = parsedCash;
        changeAmount = cashChange;
      }

      await onCompletePayment({
        paymentMethod: selectedMethod,
        paymentProvider,
        paymentReference,
        amountPaid,
        changeAmount,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickCashOptions = [
    totalAmount,
    Math.ceil(totalAmount / 10000) * 10000,
    Math.ceil(totalAmount / 50000) * 50000,
    Math.max(100000, Math.ceil(totalAmount / 100000) * 100000),
  ].filter((val, idx, arr) => arr.indexOf(val) === idx);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t.payModalTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {customerName} · {t.posTotal}:{' '}
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {formatIDR(totalAmount)}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition-colors"
            aria-label={t.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Interactive Payment Method Segmented Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
            {[
              { id: 'qris' as const, label: t.payMethodQris, icon: QrCode },
              { id: 'ewallet' as const, label: t.payMethodEwallet, icon: Wallet },
              { id: 'va_bank' as const, label: t.payMethodVa, icon: Building2 },
              { id: 'card' as const, label: t.payMethodCard, icon: CreditCard },
              { id: 'cash' as const, label: t.payMethodCash, icon: Banknote },
            ].map((item) => {
              const Icon = item.icon;
              const active = selectedMethod === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedMethod(item.id);
                    if (item.id === 'cash') {
                      setCashInput(String(totalAmount));
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Method Details Panel */}
          {selectedMethod === 'qris' && (
            <div className="flex flex-col sm:flex-row items-center gap-6 p-5 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-950/40">
              {/* Crisp SVG Dynamic QRIS Code */}
              <div className="bg-white p-3.5 border border-slate-200 rounded-lg shrink-0 flex flex-col items-center">
                <div className="text-[10px] font-bold tracking-wider text-slate-900 mb-1">
                  QRIS · K4 Store RETAIL
                </div>
                <svg
                  viewBox="0 0 120 120"
                  className="w-36 h-36 text-slate-900"
                  fill="currentColor"
                >
                  {/* Finder Patterns */}
                  <path d="M10,10 h30 v30 h-30 z M15,15 v20 h20 v-20 z M20,20 h10 v10 h-10 z" />
                  <path d="M80,10 h30 v30 h-30 z M85,15 v20 h20 v-20 z M90,20 h10 v10 h-10 z" />
                  <path d="M10,80 h30 v30 h-30 z M15,85 v20 h20 v-20 z M20,90 h10 v10 h-10 z" />
                  {/* Data Modules */}
                  <rect x="46" y="12" width="6" height="6" />
                  <rect x="58" y="12" width="12" height="6" />
                  <rect x="46" y="24" width="12" height="6" />
                  <rect x="64" y="24" width="6" height="12" />
                  <rect x="12" y="46" width="12" height="6" />
                  <rect x="30" y="46" width="6" height="12" />
                  <rect x="46" y="46" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="4" />
                  <rect x="54" y="54" width="8" height="8" />
                  <rect x="78" y="46" width="12" height="6" />
                  <rect x="96" y="46" width="12" height="12" />
                  <rect x="12" y="64" width="6" height="10" />
                  <rect x="24" y="64" width="12" height="6" />
                  <rect x="78" y="64" width="6" height="18" />
                  <rect x="90" y="68" width="18" height="6" />
                  <rect x="46" y="78" width="12" height="6" />
                  <rect x="64" y="84" width="10" height="12" />
                  <rect x="46" y="92" width="6" height="16" />
                  <rect x="58" y="100" width="16" height="8" />
                  <rect x="84" y="88" width="12" height="12" />
                  <rect x="100" y="96" width="10" height="12" />
                </svg>
                <div className="text-[10px] font-mono text-slate-500 mt-1">
                  NMID: ID1026098821901
                </div>
              </div>

              <div className="space-y-3 text-left flex-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  GoPay · OVO · DANA · ShopeePay · LinkAja · BCA Mobile · Livin
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {t.qrisInstruction}
                </p>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500">{t.posTotal}</span>
                  <span className="text-lg font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                    {formatIDR(totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {selectedMethod === 'ewallet' && (
            <div className="space-y-4 p-5 border border-slate-200 dark:border-slate-800 rounded-lg">
              <div className="flex flex-wrap gap-2">
                {(['GoPay', 'OVO', 'DANA', 'ShopeePay'] as const).map((prov) => (
                  <button
                    key={prov}
                    type="button"
                    onClick={() => setEwalletProvider(prov)}
                    className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      ewalletProvider === prov
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {prov}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  Provider: <strong className="text-slate-900 dark:text-white">{ewalletProvider} Instant Push</strong>
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                  {formatIDR(totalAmount)}
                </span>
              </div>
            </div>
          )}

          {selectedMethod === 'va_bank' && (
            <div className="space-y-4 p-5 border border-slate-200 dark:border-slate-800 rounded-lg">
              <div className="flex flex-wrap gap-2">
                {(['BCA', 'Mandiri', 'BNI', 'BRI'] as const).map((bank) => (
                  <button
                    key={bank}
                    type="button"
                    onClick={() => setBankProvider(bank)}
                    className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      bankProvider === bank
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    Bank {bank}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.vaInstruction}
              </p>
              <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {bankProvider} Virtual Account
                  </div>
                  <div className="text-base font-mono font-semibold text-slate-900 dark:text-white tracking-wider">
                    {generatedVaNumber}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyVa}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                >
                  {copiedVa ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy VA</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {selectedMethod === 'card' && (
            <div className="space-y-4 p-5 border border-slate-200 dark:border-slate-800 rounded-lg">
              <div className="flex flex-wrap gap-2">
                {(['Debit BCA', 'Visa Contactless', 'Mastercard'] as const).map((card) => (
                  <button
                    key={card}
                    type="button"
                    onClick={() => setCardProvider(card)}
                    className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      cardProvider === card
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {card}
                  </button>
                ))}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Terminal EDC siap menerima Tap / Chip PIN untuk nominal{' '}
                <strong className="font-mono text-slate-900 dark:text-white">
                  {formatIDR(totalAmount)}
                </strong>
                .
              </div>
            </div>
          )}

          {selectedMethod === 'cash' && (
            <div className="space-y-4 p-5 border border-slate-200 dark:border-slate-800 rounded-lg">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t.cashReceivedLabel}
                </label>
                <input
                  type="number"
                  min={totalAmount}
                  step={500}
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {quickCashOptions.map((amt, index) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCashInput(String(amt))}
                    className="px-3 py-1.5 text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md transition-colors"
                  >
                    {index === 0 ? `${t.cashExact} (${formatIDR(amt)})` : formatIDR(amt)}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {t.cashChangeLabel}
                </span>
                <span className="text-lg font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatIDR(cashChange)}
                </span>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              disabled={!isCashValid || isSubmitting}
              onClick={handleConfirm}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? t.verifyingPayment : t.confirmPayment}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
