import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import blueprint from '../firebase-blueprint.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Google Workspace Scopes configured for Google Drive & Google Sheets
export const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});

export const BOOTSTRAPPED_ADMIN_EMAIL = 'rizalfahriansyah03@gmail.com';

// In-memory cache for Google Workspace OAuth access token (never stored in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearAccessToken(): void {
  cachedAccessToken = null;
}

export function getIsSigningIn(): boolean {
  return isSigningIn;
}

// Validate connection to Firestore on boot as required
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ============================================================================
// Defensive Payload Validation Synced Verbatim with firebase-blueprint.json
// ============================================================================
const productProps = blueprint.entities.Product.properties;
const transactionProps = blueprint.entities.Transaction.properties;

export const PRODUCT_CONSTRAINTS = {
  skuMin: productProps.sku.minLength,
  skuMax: productProps.sku.maxLength,
  skuPattern: new RegExp(productProps.sku.pattern),
  nameMin: productProps.name.minLength,
  nameMax: productProps.name.maxLength,
  categories: productProps.category.enum,
  unitMin: productProps.unit.minLength,
  unitMax: productProps.unit.maxLength,
  supplierMin: productProps.supplier.minLength,
  supplierMax: productProps.supplier.maxLength,
};

export const TRANSACTION_CONSTRAINTS = {
  invoiceMin: transactionProps.invoiceNumber.minLength,
  invoiceMax: transactionProps.invoiceNumber.maxLength,
  invoicePattern: new RegExp(transactionProps.invoiceNumber.pattern),
  customerNameMax: transactionProps.customerName.maxLength,
  cashierNameMax: transactionProps.cashierName.maxLength,
  itemsSummaryMax: transactionProps.itemsSummary.maxLength,
  paymentMethods: transactionProps.paymentMethod.enum,
  paymentRefPattern: new RegExp(transactionProps.paymentReference.pattern),
};

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || 'item_default';
}

export function sanitizeSku(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, PRODUCT_CONSTRAINTS.skuMax);
  return cleaned.length >= PRODUCT_CONSTRAINTS.skuMin ? cleaned : `SKU-${Date.now().toString().slice(-6)}`;
}

export async function signInWithGoogle(): Promise<{
  user: User;
  accessToken: string | null;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function signOutUser() {
  await signOut(auth);
  cachedAccessToken = null;
}

export { Timestamp };
