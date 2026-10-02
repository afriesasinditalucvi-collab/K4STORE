import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  Plus,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { Product, TransactionRecord } from '../types';
import { Language } from '../i18n/translations';
import {
  createK4StoreMasterSpreadsheet,
  DriveSpreadsheetFile,
  getSpreadsheetMetadata,
  listUserSpreadsheets,
  overwriteSheetTabWithStoreData,
  parseProductsFromSheetRows,
  readSheetTabValues,
  SpreadsheetMetadata,
} from '../utils/googleSheetsService';

interface GoogleSheetsPanelProps {
  products: Product[];
  transactions: TransactionRecord[];
  accessToken: string | null;
  lang: Language;
  onConnectGoogleWorkspace: () => Promise<void>;
  onImportProductsFromSheet: (
    imported: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>[]
  ) => Promise<void>;
}

interface PendingConfirmAction {
  type: 'create_master' | 'sync_inventory' | 'sync_transactions' | 'import_products';
  title: string;
  description: string;
  affectedSummary: string;
}

export const GoogleSheetsPanel: React.FC<GoogleSheetsPanelProps> = ({
  products,
  transactions,
  accessToken,
  lang,
  onConnectGoogleWorkspace,
  onImportProductsFromSheet,
}) => {
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [selectedSpreadsheet, setSelectedSpreadsheet] =
    useState<SpreadsheetMetadata | null>(null);
  const [selectedTabTitle, setSelectedTabTitle] = useState<string>('');
  const [sheetRows, setSheetRows] = useState<string[][]>([]);
  const [newSheetTitle, setNewSheetTitle] = useState<string>(
    `K4 Store Laporan & Stok (${new Date().toISOString().slice(0, 10)})`
  );

  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Mandatory User Confirmation Dialog state before any mutating operation
  const [pendingAction, setPendingAction] =
    useState<PendingConfirmAction | null>(null);

  const fetchSpreadsheetsList = async (token: string) => {
    setIsLoadingFiles(true);
    setStatusMessage(null);
    try {
      const files = await listUserSpreadsheets(token);
      setDriveFiles(files);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Gagal memuat daftar file Google Sheets dari Google Drive.',
      });
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchSpreadsheetsList(accessToken);
    }
  }, [accessToken]);

  const handleSelectSpreadsheet = async (spreadsheetId: string) => {
    if (!accessToken || !spreadsheetId) return;
    setIsLoadingSheet(true);
    setStatusMessage(null);
    try {
      const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
      setSelectedSpreadsheet(meta);
      const firstTab = meta.sheets[0]?.title || '';
      setSelectedTabTitle(firstTab);
      if (firstTab) {
        const values = await readSheetTabValues(
          accessToken,
          meta.spreadsheetId,
          firstTab
        );
        setSheetRows(values);
      } else {
        setSheetRows([]);
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Gagal membaca metadata Google Spreadsheet.',
      });
    } finally {
      setIsLoadingSheet(false);
    }
  };

  const handleSelectTab = async (tabTitle: string) => {
    setSelectedTabTitle(tabTitle);
    if (!accessToken || !selectedSpreadsheet || !tabTitle) return;
    setIsLoadingSheet(true);
    setStatusMessage(null);
    try {
      const values = await readSheetTabValues(
        accessToken,
        selectedSpreadsheet.spreadsheetId,
        tabTitle
      );
      setSheetRows(values);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Gagal membaca isi tab Google Sheet.',
      });
    } finally {
      setIsLoadingSheet(false);
    }
  };

  // Execute confirmed mutating action only after explicit user confirmation
  const handleConfirmMutation = async () => {
    if (!pendingAction || !accessToken) return;
    setIsMutating(true);
    setStatusMessage(null);

    try {
      if (pendingAction.type === 'create_master') {
        const titleToCreate =
          newSheetTitle.trim() || 'K4 Store Master Spreadsheet';
        const createdMeta = await createK4StoreMasterSpreadsheet(
          accessToken,
          titleToCreate,
          products,
          transactions,
          lang
        );
        await fetchSpreadsheetsList(accessToken);
        setSelectedSpreadsheet(createdMeta);
        const firstTab = createdMeta.sheets[0]?.title || '';
        setSelectedTabTitle(firstTab);
        if (firstTab) {
          const rows = await readSheetTabValues(
            accessToken,
            createdMeta.spreadsheetId,
            firstTab
          );
          setSheetRows(rows);
        }
        setStatusMessage({
          type: 'success',
          text: `Berhasil membuat Google Spreadsheet "${createdMeta.title}" beserta tab Stok_Inventaris & Transaksi_Penjualan.`,
        });
      } else if (
        pendingAction.type === 'sync_inventory' &&
        selectedSpreadsheet &&
        selectedTabTitle
      ) {
        await overwriteSheetTabWithStoreData(
          accessToken,
          selectedSpreadsheet.spreadsheetId,
          selectedTabTitle,
          'inventory',
          products,
          transactions,
          lang
        );
        const rows = await readSheetTabValues(
          accessToken,
          selectedSpreadsheet.spreadsheetId,
          selectedTabTitle
        );
        setSheetRows(rows);
        setStatusMessage({
          type: 'success',
          text: `Tab "${selectedTabTitle}" pada "${selectedSpreadsheet.title}" berhasil diperbarui dengan ${products.length} data produk.`,
        });
      } else if (
        pendingAction.type === 'sync_transactions' &&
        selectedSpreadsheet &&
        selectedTabTitle
      ) {
        await overwriteSheetTabWithStoreData(
          accessToken,
          selectedSpreadsheet.spreadsheetId,
          selectedTabTitle,
          'transactions',
          products,
          transactions,
          lang
        );
        const rows = await readSheetTabValues(
          accessToken,
          selectedSpreadsheet.spreadsheetId,
          selectedTabTitle
        );
        setSheetRows(rows);
        setStatusMessage({
          type: 'success',
          text: `Tab "${selectedTabTitle}" pada "${selectedSpreadsheet.title}" berhasil diperbarui dengan ${transactions.length} transaksi penjualan.`,
        });
      } else if (pendingAction.type === 'import_products') {
        const parsedProducts = parseProductsFromSheetRows(sheetRows);
        await onImportProductsFromSheet(parsedProducts);
        setStatusMessage({
          type: 'success',
          text: `Berhasil mengimpor dan menyinkronkan ${parsedProducts.length} produk dari tab "${selectedTabTitle}" ke katalog K4 Store.`,
        });
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat menyinkronkan data Google Sheets.',
      });
    } finally {
      setIsMutating(false);
      setPendingAction(null);
    }
  };

  const parsedImportPreview = parseProductsFromSheetRows(sheetRows);

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header Bar */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Integrasi Google Sheets & Google Drive Live Sync
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Buat spreadsheet laporan otomatis, baca tab lembaran kerja, atau sinkronkan stok & transaksi dua arah.
            </p>
          </div>
        </div>

        {accessToken && (
          <button
            type="button"
            onClick={() => fetchSpreadsheetsList(accessToken)}
            disabled={isLoadingFiles}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`}
            />
            <span>Muat Ulang File Drive</span>
          </button>
        )}
      </div>

      {/* Unauthenticated State: Official "Sign in with Google" Button */}
      {!accessToken ? (
        <div className="p-8 flex flex-col items-center justify-center text-center space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-lg">
            Hubungkan akun Google Anda untuk membaca dan menyinkronkan data inventaris serta laporan penjualan langsung ke **Google Sheets** dan **Google Drive** Anda.
          </p>

          <button
            type="button"
            onClick={onConnectGoogleWorkspace}
            className="inline-flex items-center gap-3 px-5 py-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
          >
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="w-5 h-5 block shrink-0"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
            <span>Sign in with Google</span>
          </button>
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {/* Status Banner */}
          {statusMessage && (
            <div
              className={`flex items-center justify-between gap-3 p-3.5 rounded-lg border text-xs ${
                statusMessage.type === 'success'
                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                  : 'border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/40 text-red-800 dark:text-red-200'
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                )}
                <span>{statusMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="p-1 hover:opacity-75"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Top Controls: Create New Master Spreadsheet OR Select Existing from Drive */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Create New Spreadsheet Card */}
            <div className="lg:col-span-6 p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                1. Buat Spreadsheet Master K4 Store Baru
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  placeholder="Nama file Google Sheet baru..."
                  className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() =>
                    setPendingAction({
                      type: 'create_master',
                      title: 'Konfirmasi Pembuatan Google Spreadsheet Baru',
                      description: `Anda akan membuat file Google Spreadsheet baru bernama "${
                        newSheetTitle.trim() || 'K4 Store Master Spreadsheet'
                      }" di Google Drive Anda dan mengisi datanya secara otomatis.`,
                      affectedSummary: `2 Tab akan dibuat: Stok_Inventaris (${products.length} produk) & Transaksi_Penjualan (${transactions.length} transaksi).`,
                    })
                  }
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Buat & Ekspor ke Sheets</span>
                </button>
              </div>
            </div>

            {/* Select Existing Spreadsheet from Drive */}
            <div className="lg:col-span-6 p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                2. Pilih Spreadsheet dari Google Drive ({driveFiles.length} file)
              </div>
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={selectedSpreadsheet?.spreadsheetId || ''}
                  onChange={(e) => handleSelectSpreadsheet(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">
                    -- Pilih file Google Spreadsheet untuk dibaca / disinkronkan --
                  </option>
                  {driveFiles.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Active Spreadsheet Inspector & Two-Way Sync Controls */}
          {selectedSpreadsheet && (
            <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {selectedSpreadsheet.title}
                  </span>
                  <a
                    href={selectedSpreadsheet.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <span>Buka di Google Sheets</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Dynamic Sheet Tab Selector (Never hardcoding Sheet1!) */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Pilih Tab Sheet:
                  </span>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {selectedSpreadsheet.sheets.map((tab) => (
                      <button
                        key={tab.sheetId}
                        type="button"
                        onClick={() => handleSelectTab(tab.title)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          selectedTabTitle === tab.title
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {tab.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Toolbar for Selected Tab */}
              {selectedTabTitle && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/40 dark:bg-slate-950/30">
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Tab aktif: <strong className="font-mono text-slate-900 dark:text-white">{selectedTabTitle}</strong> ·{' '}
                    <span className="font-mono">{sheetRows.length}</span> baris terbaca
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() =>
                        setPendingAction({
                          type: 'sync_inventory',
                          title: `Perbarui Isi Tab "${selectedTabTitle}" dengan Stok Produk?`,
                          description: `Tindakan ini akan menimpa (overwrite) isi tab "${selectedTabTitle}" pada file "${selectedSpreadsheet.title}" dengan daftar inventaris produk K4 Store terbaru.`,
                          affectedSummary: `${products.length} baris produk inventaris akan ditulis ke "${selectedTabTitle}".`,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Tulis Stok ke Tab Ini ({products.length})</span>
                    </button>

                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() =>
                        setPendingAction({
                          type: 'sync_transactions',
                          title: `Perbarui Isi Tab "${selectedTabTitle}" dengan Transaksi Penjualan?`,
                          description: `Tindakan ini akan menimpa (overwrite) isi tab "${selectedTabTitle}" pada file "${selectedSpreadsheet.title}" dengan riwayat transaksi penjualan K4 Store.`,
                          affectedSummary: `${transactions.length} baris transaksi penjualan akan ditulis ke "${selectedTabTitle}".`,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Tulis Transaksi ke Tab Ini ({transactions.length})</span>
                    </button>

                    {parsedImportPreview.length > 0 && (
                      <button
                        type="button"
                        disabled={isMutating}
                        onClick={() =>
                          setPendingAction({
                            type: 'import_products',
                            title: `Impor ${parsedImportPreview.length} Produk dari Google Sheets?`,
                            description: `Anda akan mengimpor dan memperbarui katalog stok K4 Store menggunakan data dari tab "${selectedTabTitle}" pada "${selectedSpreadsheet.title}".`,
                            affectedSummary: `${parsedImportPreview.length} item produk valid terdeteksi (contoh: ${parsedImportPreview
                              .slice(0, 3)
                              .map((p) => p.name)
                              .join(', ')}).`,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Impor Produk ke K4 Store ({parsedImportPreview.length})</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Live Data Preview Grid */}
              {isLoadingSheet ? (
                <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                  Memuat data sel dari Google Sheets...
                </div>
              ) : sheetRows.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                  Tab ini masih kosong. Gunakan tombol &ldquo;Tulis Stok ke Tab Ini&rdquo; atau &ldquo;Tulis Transaksi ke Tab Ini&rdquo; di atas untuk mengisi data.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg max-h-72">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                        {sheetRows[0]?.map((colHeader, idx) => (
                          <th
                            key={idx}
                            className="py-2.5 px-3 font-semibold whitespace-nowrap border-r last:border-r-0 border-slate-200 dark:border-slate-800"
                          >
                            {colHeader || `Kolom ${idx + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {sheetRows.slice(1, 26).map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                        >
                          {sheetRows[0]?.map((_, cIdx) => (
                            <td
                              key={cIdx}
                              className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap border-r last:border-r-0 border-slate-100 dark:border-slate-800/60 tabular-nums"
                            >
                              {row[cIdx] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* Mandatory Explicit User Confirmation Modal for Mutating Operations  */}
      {/* =================================================================== */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {pendingAction.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {pendingAction.description}
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-slate-700 dark:text-slate-300">
                {pendingAction.affectedSummary}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => setPendingAction(null)}
                  className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={handleConfirmMutation}
                  className="px-4 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {isMutating ? 'Memproses...' : 'Konfirmasi & Lanjutkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
