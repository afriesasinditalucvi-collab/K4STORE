import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Globe,
  LogIn,
  LogOut,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
  User,
  X,
} from 'lucide-react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  clearAccessToken,
  db,
  getAccessToken,
  getIsSigningIn,
  handleFirestoreError,
  OperationType,
  PRODUCT_CONSTRAINTS,
  sanitizeId,
  sanitizeSku,
  signInWithGoogle,
  signOutUser,
  TRANSACTION_CONSTRAINTS,
} from './firebase';
import {
  AppView,
  CartItem,
  PaymentMethodType,
  Product,
  TransactionRecord,
  UserRoleMode,
} from './types';
import { INITIAL_PRODUCTS, INITIAL_TRANSACTIONS } from './data/initialCatalog';
import { Language, translations } from './i18n/translations';
import { AnalyticsView } from './components/AnalyticsView';
import { PosCashierView } from './components/PosCashierView';
import { InventoryView } from './components/InventoryView';
import { ReportsView } from './components/ReportsView';
import { StorefrontView } from './components/StorefrontView';
import { PaymentModal } from './components/PaymentModal';
import { ReceiptModal } from './components/ReceiptModal';

export default function App() {
  // Language & Theme State
  const [lang, setLang] = useState<Language>('id');
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const t = translations[lang];

  // Navigation & Role Mode
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [roleMode, setRoleMode] = useState<UserRoleMode>('admin');

  // Firebase Auth & In-Memory Google Workspace OAuth Token State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [workspaceToken, setWorkspaceToken] = useState<string | null>(() =>
    getAccessToken()
  );
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Modals & Drawers
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [pendingCheckout, setPendingCheckout] = useState<{
    customerName: string;
    orderType: 'pos_cashier' | 'customer_self_order';
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
  } | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<TransactionRecord | null>(null);

  // Store Data State (Synced with Firestore when authenticated, or local state in Guest/Preview mode)
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('K4 Store_products_v1');
      return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  });

  const [transactions, setTransactions] = useState<TransactionRecord[]>(() => {
    try {
      const saved = localStorage.getItem('K4 Store_transactions_v1');
      return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  const [cart, setCart] = useState<CartItem[]>([]);

  // Apply Dark Mode class on root html element
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Persist local state fallback for Guest Mode
  useEffect(() => {
    try {
      localStorage.setItem('K4 Store_products_v1', JSON.stringify(products));
    } catch {
      // ignore storage quota errors
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem('K4 Store_transactions_v1', JSON.stringify(transactions));
    } catch {
      // ignore storage quota errors
    }
  }, [transactions]);

  // Listen to Firebase Auth State & In-Memory OAuth Token Lifecycle
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
      if (user) {
        const memToken = getAccessToken();
        if (memToken) {
          setWorkspaceToken(memToken);
        } else if (!getIsSigningIn()) {
          clearAccessToken();
          setWorkspaceToken(null);
        }
        if (user.email === BOOTSTRAPPED_ADMIN_EMAIL) {
          setRoleMode('admin');
        } else {
          setRoleMode('customer');
          setActiveView('storefront');
        }
      } else {
        clearAccessToken();
        setWorkspaceToken(null);
      }
    });
    return () => unsub();
  }, []);

  const isCloudAdmin =
    Boolean(currentUser?.emailVerified) &&
    currentUser?.email === BOOTSTRAPPED_ADMIN_EMAIL;

  // Attach Firestore Real-Time Listeners ONLY when Auth is Ready and User is Verified
  useEffect(() => {
    if (!isAuthReady || !currentUser || !currentUser.emailVerified) {
      return;
    }

    const productsQuery = query(
      collection(db, 'products'),
      where('visibility', '==', 'public')
    );

    const unsubProducts = onSnapshot(
      productsQuery,
      async (snapshot) => {
        if (snapshot.empty && isCloudAdmin) {
          // Automatically seed initial catalog on first admin login
          for (const item of INITIAL_PRODUCTS) {
            const docRef = doc(db, 'products', sanitizeId(item.id));
            try {
              await setDoc(docRef, {
                sku: sanitizeSku(item.sku),
                name: item.name.slice(0, PRODUCT_CONSTRAINTS.nameMax),
                category: item.category,
                price: item.price,
                costPrice: item.costPrice,
                stock: item.stock,
                minStock: item.minStock,
                unit: item.unit.slice(0, PRODUCT_CONSTRAINTS.unitMax),
                imageKey: item.imageKey,
                supplier: item.supplier.slice(0, PRODUCT_CONSTRAINTS.supplierMax),
                visibility: 'public',
                updatedBy: currentUser.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, `products/${item.id}`);
            }
          }
          return;
        }

        if (!snapshot.empty) {
          const loaded: Product[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              sku: String(data.sku || 'SKU-000'),
              name: String(data.name || ''),
              category: data.category || 'sembako',
              price: Number(data.price || 0),
              costPrice: Number(data.costPrice || 0),
              stock: Number(data.stock || 0),
              minStock: Number(data.minStock || 0),
              unit: String(data.unit || 'pcs'),
              imageKey: String(data.imageKey || 'daily_essentials'),
              supplier: String(data.supplier || 'K4 Store Supplier'),
              visibility: 'public',
              updatedBy: String(data.updatedBy || ''),
              createdAt:
                data.createdAt?.toDate?.()?.toISOString?.() ||
                new Date().toISOString(),
              updatedAt:
                data.updatedAt?.toDate?.()?.toISOString?.() ||
                new Date().toISOString(),
            };
          });
          setProducts(loaded);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'products');
      }
    );

    const txQuery = isCloudAdmin
      ? query(
          collection(db, 'transactions'),
          where('storeScope', '==', 'K4 Store_global')
        )
      : query(
          collection(db, 'transactions'),
          where('customerId', '==', currentUser.uid)
        );

    const unsubTransactions = onSnapshot(
      txQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedTx: TransactionRecord[] = snapshot.docs
            .map((d) => {
              const data = d.data();
              return {
                id: d.id,
                invoiceNumber: String(data.invoiceNumber || ''),
                customerId: String(data.customerId || ''),
                customerName: String(data.customerName || ''),
                cashierName: String(data.cashierName || ''),
                orderType:
                  data.orderType === 'customer_self_order'
                    ? ('customer_self_order' as const)
                    : ('pos_cashier' as const),
                itemsSummary: String(data.itemsSummary || ''),
                totalItems: Number(data.totalItems || 1),
                subtotal: Number(data.subtotal || 0),
                discountAmount: Number(data.discountAmount || 0),
                taxAmount: Number(data.taxAmount || 0),
                totalAmount: Number(data.totalAmount || 0),
                totalProfit: Number(data.totalProfit || 0),
                paymentMethod: (data.paymentMethod || 'qris') as PaymentMethodType,
                paymentProvider: String(data.paymentProvider || 'QRIS'),
                paymentReference: String(data.paymentReference || 'REF-001'),
                amountPaid: Number(data.amountPaid || 0),
                changeAmount: Number(data.changeAmount || 0),
                status: (data.status || 'completed') as TransactionRecord['status'],
                storeScope: 'K4 Store_global' as const,
                createdAt:
                  data.createdAt?.toDate?.()?.toISOString?.() ||
                  new Date().toISOString(),
                updatedAt:
                  data.updatedAt?.toDate?.()?.toISOString?.() ||
                  new Date().toISOString(),
              };
            })
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

          setTransactions((prev) => {
            // Merge cloud transactions with seed historical transactions for rich 7-day analytics
            const cloudIds = new Set(loadedTx.map((t) => t.id));
            const seeds = prev.filter(
              (p) => p.id.startsWith('tx_seed_') && !cloudIds.has(p.id)
            );
            return [...loadedTx, ...seeds];
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'transactions');
      }
    );

    return () => {
      unsubProducts();
      unsubTransactions();
    };
  }, [isAuthReady, currentUser, isCloudAdmin]);

  // Low-Stock Items Calculated Automatically in Real Time
  const lowStockItems = products.filter((p) => p.stock <= p.minStock);

  // Cart Handlers
  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty > item.product.stock) return item;
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleClearCart = () => setCart([]);

  // Complete Checkout & Deduct Stock
  const handleCompletePayment = async (paymentDetails: {
    paymentMethod: PaymentMethodType;
    paymentProvider: string;
    paymentReference: string;
    amountPaid: number;
    changeAmount: number;
  }) => {
    if (!pendingCheckout || cart.length === 0) return;

    const nowIso = new Date().toISOString();
    const dateCode = nowIso.slice(0, 10).replace(/-/g, '');
    const seqCode = Math.floor(100 + Math.random() * 899);
    const invoiceNumber = `INV-${dateCode}-${seqCode}`;
    const txId = `tx_${Date.now()}`;

    const itemsSummary = cart
      .map((c) => `${c.product.name} x${c.quantity}`)
      .join(', ')
      .slice(0, TRANSACTION_CONSTRAINTS.itemsSummaryMax);

    const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);
    const rawProfit = cart.reduce(
      (sum, c) => sum + (c.product.price - c.product.costPrice) * c.quantity,
      0
    );
    const totalProfit = Math.max(0, rawProfit - pendingCheckout.discountAmount);

    const cashierLabel =
      pendingCheckout.orderType === 'pos_cashier'
        ? currentUser?.displayName || 'Kasir POS Utama'
        : 'Self-Checkout Kiosk';

    const newTx: TransactionRecord = {
      id: txId,
      invoiceNumber,
      customerId: currentUser?.uid || 'guest_user',
      customerName: pendingCheckout.customerName.slice(
        0,
        TRANSACTION_CONSTRAINTS.customerNameMax
      ),
      cashierName: cashierLabel.slice(0, TRANSACTION_CONSTRAINTS.cashierNameMax),
      orderType: pendingCheckout.orderType,
      itemsSummary,
      totalItems,
      subtotal: pendingCheckout.subtotal,
      discountAmount: pendingCheckout.discountAmount,
      taxAmount: pendingCheckout.taxAmount,
      totalAmount: pendingCheckout.totalAmount,
      totalProfit,
      paymentMethod: paymentDetails.paymentMethod,
      paymentProvider: paymentDetails.paymentProvider,
      paymentReference: paymentDetails.paymentReference,
      amountPaid: paymentDetails.amountPaid,
      changeAmount: paymentDetails.changeAmount,
      status: 'completed',
      storeScope: 'K4 Store_global',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Update local state immediately for snappy UX & Guest Mode
    setTransactions((prev) => [newTx, ...prev]);
    setProducts((prev) =>
      prev.map((p) => {
        const bought = cart.find((c) => c.product.id === p.id);
        if (!bought) return p;
        return {
          ...p,
          stock: Math.max(0, p.stock - bought.quantity),
          updatedAt: nowIso,
        };
      })
    );

    // Persist to Firestore if authenticated & verified
    if (currentUser && currentUser.emailVerified) {
      try {
        await setDoc(doc(db, 'transactions', sanitizeId(txId)), {
          invoiceNumber: newTx.invoiceNumber,
          customerId: currentUser.uid,
          customerName: newTx.customerName,
          cashierName: newTx.cashierName,
          orderType: newTx.orderType,
          itemsSummary: newTx.itemsSummary,
          totalItems: newTx.totalItems,
          subtotal: newTx.subtotal,
          discountAmount: newTx.discountAmount,
          taxAmount: newTx.taxAmount,
          totalAmount: newTx.totalAmount,
          totalProfit: newTx.totalProfit,
          paymentMethod: newTx.paymentMethod,
          paymentProvider: newTx.paymentProvider,
          paymentReference: newTx.paymentReference,
          amountPaid: newTx.amountPaid,
          changeAmount: newTx.changeAmount,
          status: 'completed',
          storeScope: 'K4 Store_global',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `transactions/${txId}`);
      }

      for (const item of cart) {
        const newStock = Math.max(0, item.product.stock - item.quantity);
        const prodDocRef = doc(db, 'products', sanitizeId(item.product.id));
        try {
          await updateDoc(prodDocRef, {
            stock: newStock,
            updatedBy: currentUser.uid,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(
            err,
            OperationType.UPDATE,
            `products/${item.product.id}`
          );
        }
      }
    }

    setCart([]);
    setPendingCheckout(null);
    setSelectedReceipt(newTx);
  };

  // Inventory CRUD & Quick Restock Handlers
  const handleQuickRestock = async (product: Product, addedQty: number) => {
    const updatedStock = Math.min(1000000, product.stock + addedQty);
    const nowIso = new Date().toISOString();

    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, stock: updatedStock, updatedAt: nowIso } : p
      )
    );

    if (currentUser && isCloudAdmin) {
      const prodDocRef = doc(db, 'products', sanitizeId(product.id));
      try {
        await updateDoc(prodDocRef, {
          stock: updatedStock,
          updatedBy: currentUser.uid,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `products/${product.id}`);
      }
    }
  };

  const handleSaveProduct = async (
    productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>,
    existingId?: string
  ) => {
    const nowIso = new Date().toISOString();
    const targetId = existingId || `prod_${Date.now()}`;

    if (existingId) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === existingId
            ? {
                ...p,
                ...productData,
                updatedAt: nowIso,
              }
            : p
        )
      );

      if (currentUser && isCloudAdmin) {
        try {
          await updateDoc(doc(db, 'products', sanitizeId(existingId)), {
            name: productData.name,
            category: productData.category,
            price: productData.price,
            costPrice: productData.costPrice,
            stock: productData.stock,
            minStock: productData.minStock,
            unit: productData.unit,
            imageKey: productData.imageKey,
            supplier: productData.supplier,
            visibility: productData.visibility,
            updatedBy: currentUser.uid,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `products/${existingId}`);
        }
      }
    } else {
      const created: Product = {
        id: targetId,
        ...productData,
        updatedBy: currentUser?.uid || 'local_admin',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setProducts((prev) => [created, ...prev]);

      if (currentUser && isCloudAdmin) {
        try {
          await setDoc(doc(db, 'products', sanitizeId(targetId)), {
            sku: productData.sku,
            name: productData.name,
            category: productData.category,
            price: productData.price,
            costPrice: productData.costPrice,
            stock: productData.stock,
            minStock: productData.minStock,
            unit: productData.unit,
            imageKey: productData.imageKey,
            supplier: productData.supplier,
            visibility: 'public',
            updatedBy: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `products/${targetId}`);
        }
      }
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setCart((prev) => prev.filter((c) => c.product.id !== productId));

    if (currentUser && isCloudAdmin) {
      try {
        await deleteDoc(doc(db, 'products', sanitizeId(productId)));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
      }
    }
  };

  const handleGoogleSignIn = async (intendedRole: 'admin' | 'customer') => {
    setAuthError(null);
    try {
      const cred = await signInWithGoogle();
      setWorkspaceToken(cred.accessToken);
      if (intendedRole === 'admin') {
        setRoleMode('admin');
        setActiveView('dashboard');
      } else {
        setRoleMode('customer');
        setActiveView('storefront');
      }
      if (cred.user) {
        setIsAuthModalOpen(false);
      }
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Gagal melakukan login Google.'
      );
    }
  };

  const handleConnectGoogleWorkspace = async () => {
    setAuthError(null);
    const cred = await signInWithGoogle();
    setWorkspaceToken(cred.accessToken);
  };

  const handleImportProductsFromSheet = async (
    imported: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>[]
  ) => {
    for (const item of imported) {
      const existing = products.find(
        (p) => p.sku.toUpperCase() === item.sku.toUpperCase()
      );
      await handleSaveProduct(item, existing?.id);
    }
  };

  const navItems: { id: AppView; label: string }[] =
    roleMode === 'admin'
      ? [
          { id: 'dashboard', label: t.navDashboard },
          { id: 'pos', label: t.navPos },
          { id: 'inventory', label: t.navInventory },
          { id: 'reports', label: t.navReports },
          { id: 'storefront', label: t.navStorefront },
        ]
      : [{ id: 'storefront', label: t.navStorefront }];

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col">
      {/* =================================================================== */}
      {/* Top Navigation Bar — Strict 3-Zone Contract (frontend-design Sec 2) */}
      {/* =================================================================== */}
      <header className="sticky top-0 z-40 h-16 px-4 sm:px-8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark in Display Face */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveView(roleMode === 'admin' ? 'dashboard' : 'storefront');
          }}
          className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-white whitespace-nowrap"
        >
          {t.brandName}
        </a>

        {/* Zone 2: 1-5 clean text navigation links with subtle hover underlines */}
        <nav className="flex items-center gap-5 sm:gap-7 text-sm font-medium text-slate-600 dark:text-slate-400 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  isActive
                    ? 'border-emerald-600 dark:border-emerald-400 text-slate-900 dark:text-white font-semibold'
                    : 'border-transparent hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action Controls (Low-Stock Alerts + Preferences + Account) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Low-Stock Alert Bell */}
          <button
            type="button"
            onClick={() => setIsNotifOpen((prev) => !prev)}
            className="relative p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label={t.lowStockAlertTitle}
          >
            <Bell className="w-4 h-4" />
            {lowStockItems.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-mono font-bold bg-amber-500 text-slate-950 rounded-full flex items-center justify-center">
                {lowStockItems.length}
              </span>
            )}
          </button>

          {/* Language Toggle (ID / EN) */}
          <button
            type="button"
            onClick={() => setLang((prev) => (prev === 'id' ? 'en' : 'id'))}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            aria-label="Switch Language"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{lang.toUpperCase()}</span>
          </button>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={() => setDarkMode((prev) => !prev)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Toggle Dark Mode"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User Login & Mode Switcher CTA */}
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap"
          >
            <User className="w-3.5 h-3.5" />
            <span>
              {currentUser
                ? currentUser.displayName?.split(' ')[0] || t.roleAdmin
                : roleMode === 'guest'
                ? t.roleGuest
                : t.roleAdmin}
            </span>
          </button>
        </div>
      </header>

      {/* =================================================================== */}
      {/* Automated Low-Stock Notification Drawer                             */}
      {/* =================================================================== */}
      {isNotifOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t.lowStockAlertTitle} ({lowStockItems.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNotifOpen(false)}
                  className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {lowStockItems.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                  {t.allStockHealthy}
                </p>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {lowStockItems.map((item) => (
                    <div
                      key={item.id}
                      className="py-3.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {item.name}
                        </div>
                        <div className="font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.sku} · Stok:{' '}
                          <strong className="text-red-600 dark:text-red-400">
                            {item.stock} {item.unit}
                          </strong>{' '}
                          (Min: {item.minStock})
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickRestock(item, 15)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md whitespace-nowrap"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{t.addStock15}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setRoleMode('admin');
                setActiveView('inventory');
                setIsNotifOpen(false);
              }}
              className="w-full py-2.5 px-4 text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Buka Manajemen Stok Lengkap
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* User Login & Role Switcher Modal (Admin / Customer / Guest Mode)    */}
      {/* =================================================================== */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Akses Pengguna & Mode Transaksi
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {currentUser ? (
                <div className="p-4 border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-lg space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Login Aktif: {currentUser.displayName || currentUser.email}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 font-mono">
                    {currentUser.email} ·{' '}
                    {isCloudAdmin ? 'Super Admin Cloud' : 'Member Pelanggan'}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await signOutUser();
                      setRoleMode('guest');
                      setActiveView('storefront');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:bg-red-50"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t.logout}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Masuk menggunakan akun Google untuk sinkronisasi Cloud Firestore
                    real-time, atau gunakan Mode Tamu tanpa perlu login.
                  </p>
                  <div className="grid grid-cols-1 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleGoogleSignIn('admin')}
                      className="flex items-center justify-center gap-2 py-2.5 px-4 font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg transition-colors"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>{t.loginAsAdmin} (Google)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGoogleSignIn('customer')}
                      className="flex items-center justify-center gap-2 py-2.5 px-4 font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <User className="w-4 h-4" />
                      <span>{t.loginAsCustomer} (Member 5% Off)</span>
                    </button>
                  </div>
                  {authError && (
                    <p className="text-red-600 dark:text-red-400 text-xs">{authError}</p>
                  )}
                </div>
              )}

              {/* Quick Workspace Switcher (Admin POS vs Guest Storefront) */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="font-medium text-slate-700 dark:text-slate-300">
                  {t.switchMode}:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRoleMode('admin');
                      setActiveView('dashboard');
                      setIsAuthModalOpen(false);
                    }}
                    className={`p-3 text-left rounded-lg border transition-colors ${
                      roleMode === 'admin'
                        ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-slate-900 dark:text-white font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div>{t.roleAdmin}</div>
                    <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                      Kasir POS, Stok & Analitik
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRoleMode(currentUser ? 'customer' : 'guest');
                      setActiveView('storefront');
                      setIsAuthModalOpen(false);
                    }}
                    className={`p-3 text-left rounded-lg border transition-colors ${
                      roleMode !== 'admin'
                        ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-slate-900 dark:text-white font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div>{t.continueAsGuest}</div>
                    <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                      Belanja Mandiri Tanpa Login
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* Main Content Viewport (1440px max-w-7xl desktop layout)             */}
      {/* =================================================================== */}
      <main id="top" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {activeView === 'dashboard' && (
          <AnalyticsView
            products={products}
            transactions={transactions}
            lang={lang}
            onQuickRestock={handleQuickRestock}
            onSelectReceipt={(tx) => setSelectedReceipt(tx)}
            onNavigateInventory={() => setActiveView('inventory')}
          />
        )}

        {activeView === 'pos' && (
          <PosCashierView
            products={products}
            cart={cart}
            lang={lang}
            onAddToCart={handleAddToCart}
            onUpdateCartQty={handleUpdateCartQty}
            onClearCart={handleClearCart}
            onOpenPayment={(data) =>
              setPendingCheckout({
                ...data,
                orderType: 'pos_cashier',
              })
            }
          />
        )}

        {activeView === 'inventory' && (
          <InventoryView
            products={products}
            transactions={transactions}
            accessToken={workspaceToken}
            lang={lang}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onQuickRestock={handleQuickRestock}
            onConnectGoogleWorkspace={handleConnectGoogleWorkspace}
            onImportProductsFromSheet={handleImportProductsFromSheet}
          />
        )}

        {activeView === 'reports' && (
          <ReportsView
            products={products}
            transactions={transactions}
            accessToken={workspaceToken}
            lang={lang}
            onSelectReceipt={(tx) => setSelectedReceipt(tx)}
            onConnectGoogleWorkspace={handleConnectGoogleWorkspace}
            onImportProductsFromSheet={handleImportProductsFromSheet}
          />
        )}

        {activeView === 'storefront' && (
          <StorefrontView
            products={products}
            cart={cart}
            transactions={transactions}
            roleMode={roleMode}
            userDisplayName={currentUser?.displayName || ''}
            lang={lang}
            onAddToCart={handleAddToCart}
            onUpdateCartQty={handleUpdateCartQty}
            onOpenSelfCheckout={(data) =>
              setPendingCheckout({
                ...data,
                orderType: 'customer_self_order',
              })
            }
            onSelectReceipt={(tx) => setSelectedReceipt(tx)}
            onLoginCustomer={() => setIsAuthModalOpen(true)}
          />
        )}
      </main>

      {/* Quiet Editorial Footer (No mechanical telemetry tickers) */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 px-4 sm:px-8 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            © {new Date().getFullYear()} K4 Store POS & Minimarket. Seluruh hak cipta dilindungi.
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setRoleMode('admin');
                setActiveView('pos');
              }}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {t.navPos}
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => {
                setRoleMode('guest');
                setActiveView('storefront');
              }}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {t.roleGuest}
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => {
                setRoleMode('admin');
                setActiveView('reports');
              }}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {t.navReports} (PDF & Excel)
            </button>
          </div>
        </div>
      </footer>

      {/* Digital Payment Gateway Modal */}
      <PaymentModal
        isOpen={Boolean(pendingCheckout)}
        totalAmount={pendingCheckout?.totalAmount || 0}
        customerName={pendingCheckout?.customerName || ''}
        lang={lang}
        onClose={() => setPendingCheckout(null)}
        onCompletePayment={handleCompletePayment}
      />

      {/* Official Receipt Modal */}
      <ReceiptModal
        transaction={selectedReceipt}
        lang={lang}
        onClose={() => setSelectedReceipt(null)}
      />
    </div>
  );
}
