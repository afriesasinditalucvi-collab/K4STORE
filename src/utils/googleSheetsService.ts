import { Product, ProductCategory, TransactionRecord } from '../types';
import { formatDateTime } from './exportReports';
import { Language } from '../i18n/translations';
import { sanitizeSku } from '../firebase';

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: SheetTabInfo[];
}

export async function listUserSpreadsheets(
  accessToken: string
): Promise<DriveSpreadsheetFile[]> {
  const q = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=15`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message || `Google Drive API error (${res.status})`
    );
  }

  const data = await res.json();
  return Array.isArray(data.files) ? data.files : [];
}

export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties(sheetId,title)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message || `Google Sheets Metadata error (${res.status})`
    );
  }

  const data = await res.json();
  const sheets: SheetTabInfo[] = Array.isArray(data.sheets)
    ? data.sheets.map((s: { properties?: { sheetId?: number; title?: string } }, idx: number) => ({
        sheetId: s.properties?.sheetId ?? idx,
        title: s.properties?.title || `Tab_${idx + 1}`,
      }))
    : [];

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Untitled Spreadsheet',
    spreadsheetUrl:
      data.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
    sheets,
  };
}

export async function readSheetTabValues(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string
): Promise<string[][]> {
  const escapedTab = `'${sheetTitle.replace(/'/g, "''")}'!A1:Z200`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(escapedTab)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message || `Failed to read sheet values (${res.status})`
    );
  }

  const data = await res.json();
  return Array.isArray(data.values) ? data.values : [];
}

export function buildInventorySheetRows(products: Product[]): (string | number)[][] {
  const header = [
    'SKU',
    'Nama Produk',
    'Kategori',
    'Harga Modal (IDR)',
    'Harga Jual (IDR)',
    'Margin Unit (IDR)',
    'Stok Tersedia',
    'Batas Minimum',
    'Satuan',
    'Pemasok',
    'Status Stok',
  ];

  const rows = products.map((p) => [
    p.sku,
    p.name,
    p.category,
    p.costPrice,
    p.price,
    p.price - p.costPrice,
    p.stock,
    p.minStock,
    p.unit,
    p.supplier,
    p.stock === 0 ? 'HABIS' : p.stock <= p.minStock ? 'STOK MENIPIS' : 'AMAN',
  ]);

  return [header, ...rows];
}

export function buildTransactionsSheetRows(
  transactions: TransactionRecord[],
  lang: Language = 'id'
): (string | number)[][] {
  const header = [
    'No. Invoice',
    'Waktu Transaksi',
    'Pelanggan',
    'Kasir / Kanal',
    'Tipe Order',
    'Rincian Barang',
    'Jumlah Item',
    'Subtotal (IDR)',
    'Diskon (IDR)',
    'PPN (IDR)',
    'Total Tagihan (IDR)',
    'Estimasi Laba (IDR)',
    'Metode Pembayaran',
    'Provider',
    'Referensi',
    'Status',
  ];

  const rows = transactions.map((tx) => [
    tx.invoiceNumber,
    formatDateTime(tx.createdAt, lang),
    tx.customerName,
    tx.cashierName,
    tx.orderType,
    tx.itemsSummary,
    tx.totalItems,
    tx.subtotal,
    tx.discountAmount,
    tx.taxAmount,
    tx.totalAmount,
    tx.totalProfit,
    tx.paymentMethod.toUpperCase(),
    tx.paymentProvider,
    tx.paymentReference,
    tx.status.toUpperCase(),
  ]);

  return [header, ...rows];
}

export async function createK4StoreMasterSpreadsheet(
  accessToken: string,
  title: string,
  products: Product[],
  transactions: TransactionRecord[],
  lang: Language = 'id'
): Promise<SpreadsheetMetadata> {
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        { properties: { title: 'Stok_Inventaris' } },
        { properties: { title: 'Transaksi_Penjualan' } },
      ],
    }),
  });

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message || `Failed to create spreadsheet (${createRes.status})`
    );
  }

  const created = await createRes.json();
  const spreadsheetId: string = created.spreadsheetId;

  const invRows = buildInventorySheetRows(products);
  const txRows = buildTransactionsSheetRows(transactions, lang);

  const batchRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `'Stok_Inventaris'!A1`,
            values: invRows,
          },
          {
            range: `'Transaksi_Penjualan'!A1`,
            values: txRows,
          },
        ],
      }),
    }
  );

  if (!batchRes.ok) {
    const errData = await batchRes.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message || `Failed to populate spreadsheet (${batchRes.status})`
    );
  }

  return getSpreadsheetMetadata(accessToken, spreadsheetId);
}

export async function overwriteSheetTabWithStoreData(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  dataType: 'inventory' | 'transactions',
  products: Product[],
  transactions: TransactionRecord[],
  lang: Language = 'id'
): Promise<void> {
  const escapedRange = `'${sheetTitle.replace(/'/g, "''")}'!A1:Z500`;

  // Clear existing range first
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(escapedRange)}:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const rows =
    dataType === 'inventory'
      ? buildInventorySheetRows(products)
      : buildTransactionsSheetRows(transactions, lang);

  const writeRange = `'${sheetTitle.replace(/'/g, "''")}'!A1`;
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: writeRange,
        majorDimension: 'ROWS',
        values: rows,
      }),
    }
  );

  if (!writeRes.ok) {
    const errData = await writeRes.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message || `Failed to write sheet data (${writeRes.status})`
    );
  }
}

const VALID_CATEGORIES: ProductCategory[] = [
  'kopi_teh',
  'makanan_ringan',
  'sembako',
  'minuman',
  'kebutuhan_rumah',
  'perawatan_diri',
];

export function parseProductsFromSheetRows(
  rows: string[][]
): Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>[] {
  if (rows.length < 2) return [];

  const dataRows = rows.slice(1);
  const parsed: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>[] = [];

  for (const row of dataRows) {
    const rawSku = String(row[0] || '').trim();
    const rawName = String(row[1] || '').trim();
    if (!rawName || rawName.length < 2) continue;

    const rawCat = String(row[2] || 'sembako')
      .trim()
      .toLowerCase() as ProductCategory;
    const category: ProductCategory = VALID_CATEGORIES.includes(rawCat)
      ? rawCat
      : 'sembako';

    const costPrice = Math.max(
      0,
      Number(String(row[3] || '10000').replace(/[^0-9]/g, '')) || 10000
    );
    const price = Math.max(
      0,
      Number(String(row[4] || '15000').replace(/[^0-9]/g, '')) || 15000
    );
    const stock = Math.max(
      0,
      Math.floor(Number(String(row[6] ?? row[5] ?? '20').replace(/[^0-9]/g, '')) || 20)
    );
    const minStock = Math.max(
      0,
      Math.floor(Number(String(row[7] ?? '8').replace(/[^0-9]/g, '')) || 8)
    );
    const unit = String(row[8] || 'pcs').trim().slice(0, 20) || 'pcs';
    const supplier =
      String(row[9] || 'K4 Store Supplier').trim().slice(0, 100) ||
      'K4 Store Supplier';

    parsed.push({
      sku: sanitizeSku(rawSku || `K4S-${Math.floor(100 + Math.random() * 900)}`),
      name: rawName.slice(0, 120),
      category,
      costPrice,
      price,
      stock,
      minStock,
      unit,
      imageKey:
        category === 'kopi_teh'
          ? 'coffee_series'
          : category === 'makanan_ringan'
          ? 'artisan_snacks'
          : category === 'minuman'
          ? 'fresh_beverages'
          : 'daily_essentials',
      supplier,
      visibility: 'public',
    });
  }

  return parsed;
}
