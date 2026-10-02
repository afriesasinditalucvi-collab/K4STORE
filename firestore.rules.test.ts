/**
 * Test Runner for Firestore Security Rules ("Dirty Dozen" Adversarial Payloads)
 * Verifies that all 12 adversarial payloads defined in security_spec.md return PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  docId: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: {
    uid: string;
    email: string;
    email_verified: boolean;
  } | null;
  existingData?: Record<string, unknown>;
  incomingData?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Transaction Create',
    collection: 'transactions',
    docId: 'tx_spoof_01',
    operation: 'create',
    auth: { uid: 'user_A', email: 'usera@example.com', email_verified: true },
    incomingData: { customerId: 'user_B', invoiceNumber: 'INV-2026-001', status: 'completed' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Self-Assigned Admin Privilege Escalation',
    collection: 'admins',
    docId: 'user_A',
    operation: 'create',
    auth: { uid: 'user_A', email: 'usera@example.com', email_verified: true },
    incomingData: { uid: 'user_A', roleName: 'super_admin' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Spoofing Attack',
    collection: 'products',
    docId: 'prod_01',
    operation: 'create',
    auth: { uid: 'attacker_1', email: 'rizalfahriansyah03@gmail.com', email_verified: false },
    incomingData: { sku: 'SKU-001', name: 'Spoofed Product', price: 10000 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow / Ghost Field Injection on Product Update',
    collection: 'products',
    docId: 'prod_01',
    operation: 'update',
    auth: { uid: 'admin_1', email: 'rizalfahriansyah03@gmail.com', email_verified: true },
    incomingData: { sku: 'SKU-001', name: 'Valid Name', isVerifiedGhostField: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Customer Price Tampering via Stock Deduction Route',
    collection: 'products',
    docId: 'prod_01',
    operation: 'update',
    auth: { uid: 'user_A', email: 'usera@example.com', email_verified: true },
    existingData: { stock: 20, price: 25000 },
    incomingData: { stock: 19, price: 100, updatedBy: 'user_A' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Customer Stock Inflation Attack',
    collection: 'products',
    docId: 'prod_01',
    operation: 'update',
    auth: { uid: 'user_A', email: 'usera@example.com', email_verified: true },
    existingData: { stock: 10 },
    incomingData: { stock: 999, updatedBy: 'user_A' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Terminal State Mutation on Completed Transaction',
    collection: 'transactions',
    docId: 'tx_01',
    operation: 'update',
    auth: { uid: 'user_A', email: 'usera@example.com', email_verified: true },
    existingData: { customerId: 'user_A', status: 'completed' },
    incomingData: { customerId: 'user_A', status: 'cancelled' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immutable Timestamp Forgery',
    collection: 'products',
    docId: 'prod_01',
    operation: 'update',
    auth: { uid: 'admin_1', email: 'rizalfahriansyah03@gmail.com', email_verified: true },
    existingData: { createdAt: '2026-10-01T00:00:00Z' },
    incomingData: { createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Client Timestamp Spoofing on Create',
    collection: 'transactions',
    docId: 'tx_02',
    operation: 'create',
    auth: { uid: 'user_A', email: 'usera@example.com', email_verified: true },
    incomingData: { customerId: 'user_A', createdAt: '1999-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'ID Poisoning with Special Characters',
    collection: 'transactions',
    docId: 'invalid$id!with@special#chars',
    operation: 'get',
    auth: { uid: 'user_A', email: 'usera@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Value Poisoning on Whitelisted Key',
    collection: 'products',
    docId: 'prod_01',
    operation: 'update',
    auth: { uid: 'user_A', email: 'usera@example.com', email_verified: true },
    existingData: { stock: 10 },
    incomingData: { stock: -50, updatedBy: 'user_A' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthorized Blanket List Scraping on Transactions',
    collection: 'transactions',
    docId: '*',
    operation: 'list',
    auth: { uid: 'user_A', email: 'usera@example.com', email_verified: true },
    existingData: { customerId: 'user_B', storeScope: 'K4 Store_global' },
    expectedResult: 'PERMISSION_DENIED',
  },
];
