import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Product, TransactionRecord } from '../types';
import { Language } from '../i18n/translations';

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(iso: string, lang: Language = 'id'): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function exportSalesReportPDF(
  transactions: TransactionRecord[],
  lang: Language = 'id'
) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const totalRevenue = transactions.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalProfit = transactions.reduce((acc, t) => acc + t.totalProfit, 0);
  const totalItems = transactions.reduce((acc, t) => acc + t.totalItems, 0);

  doc.setFontSize(16);
  doc.text(
    lang === 'id'
      ? 'K4 Store POS & MINIMARKET — LAPORAN PENJUALAN RESMI'
      : 'K4 Store POS & MINIMARKET — OFFICIAL SALES REPORT',
    14,
    18
  );

  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(
    `${lang === 'id' ? 'Dicetak pada' : 'Generated on'}: ${new Date().toLocaleString(
      lang === 'id' ? 'id-ID' : 'en-US'
    )}  |  ${lang === 'id' ? 'Total Transaksi' : 'Total Transactions'}: ${
      transactions.length
    }  |  ${lang === 'id' ? 'Total Omzet' : 'Gross Revenue'}: ${formatIDR(
      totalRevenue
    )}  |  ${lang === 'id' ? 'Estimasi Laba' : 'Est. Profit'}: ${formatIDR(
      totalProfit
    )} (${totalItems} item)`,
    14,
    26
  );

  const head =
    lang === 'id'
      ? [
          [
            'No. Invoice',
            'Tanggal',
            'Pelanggan',
            'Kanal',
            'Rincian Barang',
            'Metode Bayar',
            'Total Tagihan',
            'Laba Kotor',
            'Status',
          ],
        ]
      : [
          [
            'Invoice No.',
            'Date',
            'Customer',
            'Channel',
            'Items Summary',
            'Payment Method',
            'Total Amount',
            'Gross Profit',
            'Status',
          ],
        ];

  const body = transactions.map((tx) => [
    tx.invoiceNumber,
    formatDateTime(tx.createdAt, lang),
    tx.customerName,
    tx.orderType === 'pos_cashier' ? 'POS Kasir' : 'Self-Order',
    tx.itemsSummary,
    `${tx.paymentProvider} (${tx.paymentReference})`,
    formatIDR(tx.totalAmount),
    formatIDR(tx.totalProfit),
    tx.status.toUpperCase(),
  ]);

  autoTable(doc, {
    startY: 32,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  doc.save(`Laporan_Penjualan_K4 Store_${dateStamp}.pdf`);
}

export function exportSalesReportExcel(
  transactions: TransactionRecord[],
  lang: Language = 'id'
) {
  const totalRevenue = transactions.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalProfit = transactions.reduce((acc, t) => acc + t.totalProfit, 0);
  const totalDiscount = transactions.reduce((acc, t) => acc + t.discountAmount, 0);
  const totalTax = transactions.reduce((acc, t) => acc + t.taxAmount, 0);

  const summaryRows = [
    {
      Metrik: lang === 'id' ? 'Total Transaksi' : 'Total Transactions',
      Nilai: transactions.length,
    },
    {
      Metrik: lang === 'id' ? 'Total Pendapatan (IDR)' : 'Gross Revenue (IDR)',
      Nilai: totalRevenue,
    },
    {
      Metrik: lang === 'id' ? 'Total Estimasi Laba Kotor (IDR)' : 'Estimated Gross Profit (IDR)',
      Nilai: totalProfit,
    },
    {
      Metrik: lang === 'id' ? 'Total Diskon Promo (IDR)' : 'Total Promo Discounts (IDR)',
      Nilai: totalDiscount,
    },
    {
      Metrik: lang === 'id' ? 'Total Pajak PPN (IDR)' : 'Total Tax VAT (IDR)',
      Nilai: totalTax,
    },
  ];

  const detailRows = transactions.map((tx) => ({
    Invoice: tx.invoiceNumber,
    Waktu: formatDateTime(tx.createdAt, lang),
    Pelanggan: tx.customerName,
    Kasir_Kanal: tx.cashierName,
    Tipe_Order: tx.orderType,
    Rincian_Barang: tx.itemsSummary,
    Jumlah_Barang: tx.totalItems,
    Subtotal_IDR: tx.subtotal,
    Diskon_IDR: tx.discountAmount,
    Pajak_PPN_IDR: tx.taxAmount,
    Total_Tagihan_IDR: tx.totalAmount,
    Estimasi_Laba_IDR: tx.totalProfit,
    Metode_Pembayaran: tx.paymentMethod.toUpperCase(),
    Provider_Pembayaran: tx.paymentProvider,
    Referensi_Pembayaran: tx.paymentReference,
    Nominal_Dibayar_IDR: tx.amountPaid,
    Kembalian_IDR: tx.changeAmount,
    Status: tx.status.toUpperCase(),
  }));

  const workbook = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  const detailSheet = XLSX.utils.json_to_sheet(detailRows);

  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Daftar_Transaksi');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Ringkasan_Analitik');

  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  XLSX.writeFile(workbook, `Laporan_Penjualan_K4 Store_${dateStamp}.xlsx`);
}

export function exportInventoryReportPDF(
  products: Product[],
  lang: Language = 'id'
) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  const totalStockValuation = products.reduce(
    (acc, p) => acc + p.stock * p.costPrice,
    0
  );
  const totalRetailValuation = products.reduce(
    (acc, p) => acc + p.stock * p.price,
    0
  );

  doc.setFontSize(16);
  doc.text(
    lang === 'id'
      ? 'K4 Store POS & MINIMARKET — LAPORAN STOK & AUDIT INVENTARIS'
      : 'K4 Store POS & MINIMARKET — INVENTORY & STOCK VALUATION REPORT',
    14,
    18
  );

  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(
    `${lang === 'id' ? 'Total SKU' : 'Total SKUs'}: ${products.length}  |  ${
      lang === 'id' ? 'Stok Menipis' : 'Low Stock Items'
    }: ${lowStockCount}  |  ${
      lang === 'id' ? 'Nilai Modal Stok' : 'Cost Valuation'
    }: ${formatIDR(totalStockValuation)}  |  ${
      lang === 'id' ? 'Nilai Jual Stok' : 'Retail Valuation'
    }: ${formatIDR(totalRetailValuation)}`,
    14,
    26
  );

  const head = [
    [
      'SKU',
      lang === 'id' ? 'Nama Produk' : 'Product Name',
      lang === 'id' ? 'Kategori' : 'Category',
      lang === 'id' ? 'Pemasok' : 'Supplier',
      lang === 'id' ? 'Harga Modal' : 'Unit Cost',
      lang === 'id' ? 'Harga Jual' : 'Retail Price',
      lang === 'id' ? 'Stok' : 'Stock',
      lang === 'id' ? 'Batas Min.' : 'Min Alert',
      lang === 'id' ? 'Status' : 'Status',
    ],
  ];

  const body = products.map((p) => [
    p.sku,
    p.name,
    p.category,
    p.supplier,
    formatIDR(p.costPrice),
    formatIDR(p.price),
    `${p.stock} ${p.unit}`,
    `${p.minStock} ${p.unit}`,
    p.stock === 0
      ? lang === 'id'
        ? 'HABIS'
        : 'OUT OF STOCK'
      : p.stock <= p.minStock
      ? lang === 'id'
        ? 'MENIPIS'
        : 'LOW STOCK'
      : 'NORMAL',
  ]);

  autoTable(doc, {
    startY: 32,
    head,
    body,
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  doc.save(`Laporan_Stok_K4 Store_${dateStamp}.pdf`);
}

export function exportInventoryReportExcel(products: Product[]) {
  const allRows = products.map((p) => ({
    SKU: p.sku,
    Nama_Produk: p.name,
    Kategori: p.category,
    Pemasok: p.supplier,
    Harga_Modal_IDR: p.costPrice,
    Harga_Jual_IDR: p.price,
    Margin_Unit_IDR: p.price - p.costPrice,
    Stok_Tersedia: p.stock,
    Batas_Minimum: p.minStock,
    Satuan: p.unit,
    Nilai_Modal_Total_IDR: p.stock * p.costPrice,
    Nilai_Jual_Total_IDR: p.stock * p.price,
    Status_Stok:
      p.stock === 0 ? 'HABIS' : p.stock <= p.minStock ? 'STOK_MENIPIS' : 'AMAN',
  }));

  const lowStockRows = allRows.filter((r) => r.Status_Stok !== 'AMAN');

  const workbook = XLSX.utils.book_new();
  const mainSheet = XLSX.utils.json_to_sheet(allRows);
  const lowSheet = XLSX.utils.json_to_sheet(lowStockRows);

  XLSX.utils.book_append_sheet(workbook, mainSheet, 'Stok_Inventaris');
  XLSX.utils.book_append_sheet(workbook, lowSheet, 'Peringatan_Stok_Menipis');

  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  XLSX.writeFile(workbook, `Laporan_Stok_K4 Store_${dateStamp}.xlsx`);
}

export function exportReceiptPDF(tx: TransactionRecord, lang: Language = 'id') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 160],
  });

  doc.setFontSize(11);
  doc.text('K4 Store MINIMARKET', 40, 10, { align: 'center' });
  doc.setFontSize(7.5);
  doc.text('Jl. Sudirman Niaga No. 88, Jakarta', 40, 14.5, { align: 'center' });
  doc.text('------------------------------------------------', 40, 18.5, {
    align: 'center',
  });

  doc.setFontSize(7.5);
  doc.text(`Invoice : ${tx.invoiceNumber}`, 6, 23);
  doc.text(`Waktu   : ${formatDateTime(tx.createdAt, lang)}`, 6, 27.5);
  doc.text(`Pelanggan: ${tx.customerName}`, 6, 32);
  doc.text(`Kasir   : ${tx.cashierName}`, 6, 36.5);
  doc.text('------------------------------------------------', 40, 40.5, {
    align: 'center',
  });

  const wrappedItems = doc.splitTextToSize(tx.itemsSummary, 68);
  doc.text(wrappedItems, 6, 45);

  const nextY = 46 + wrappedItems.length * 4;
  doc.text('------------------------------------------------', 40, nextY, {
    align: 'center',
  });

  doc.text(`Subtotal      : ${formatIDR(tx.subtotal)}`, 6, nextY + 5);
  doc.text(`Diskon Promo  : -${formatIDR(tx.discountAmount)}`, 6, nextY + 9.5);
  doc.text(`PPN (11%)     : ${formatIDR(tx.taxAmount)}`, 6, nextY + 14);
  doc.setFontSize(9);
  doc.text(`TOTAL         : ${formatIDR(tx.totalAmount)}`, 6, nextY + 20);
  doc.setFontSize(7.5);
  doc.text(`Metode Bayar  : ${tx.paymentProvider}`, 6, nextY + 25.5);
  doc.text(`No. Referensi : ${tx.paymentReference}`, 6, nextY + 30);
  doc.text(`Dibayar       : ${formatIDR(tx.amountPaid)}`, 6, nextY + 34.5);
  doc.text(`Kembalian     : ${formatIDR(tx.changeAmount)}`, 6, nextY + 39);

  doc.text('------------------------------------------------', 40, nextY + 44, {
    align: 'center',
  });
  doc.text(
    lang === 'id'
      ? 'Terima kasih telah berbelanja di K4 Store!'
      : 'Thank you for shopping at K4 Store!',
    40,
    nextY + 49,
    { align: 'center' }
  );

  doc.save(`Struk_${tx.invoiceNumber}.pdf`);
}
