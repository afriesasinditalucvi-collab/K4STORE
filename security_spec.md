# K4 Store POS & Minimarket — Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Authentication & Verification Gate**: Every Firestore read and write requires an authenticated user with `request.auth != null` and `request.auth.token.email_verified == true`.
2. **Admin Role Authority**: Administrative privileges (`isAdmin()`) are granted exclusively if `isVerified()` is true AND either `request.auth.token.email == 'rizalfahriansyah03@gmail.com'` (bootstrapped admin) OR `/admins/$(request.auth.uid)` exists. Self-elevation to `/admins/{adminId}` by non-admins is strictly forbidden.
3. **Product Catalog Integrity (`/products/{productId}`)**:
   - Only `isAdmin()` may create or delete products, or modify pricing/catalog metadata.
   - Verified customers may only decrement `stock` during a valid checkout (`incoming().stock < existing().stock && incoming().stock >= 0`) while updating only `['stock', 'updatedBy', 'updatedAt']` with `updatedBy == request.auth.uid` and `updatedAt == request.time`.
   - `createdAt` and `sku` are immutable after creation.
4. **Transaction Integrity & Terminal State Locking (`/transactions/{transactionId}`)**:
   - A transaction can only be created if `incoming().customerId == request.auth.uid` and `incoming().createdAt == request.time && incoming().updatedAt == request.time`.
   - Once `status` reaches a terminal state (`'completed'`, `'cancelled'`, `'refunded'`), non-admin users are strictly blocked from making any further updates.
   - `customerId`, `invoiceNumber`, and `createdAt` are permanently immutable (`incoming().field == existing().field`).
5. **Secure List Queries (Zero Client Delegation & Zero Lookup Cost)**:
   - `/products`: `allow list` requires `isVerified() && existing().visibility == 'public'`.
   - `/transactions`: `allow list` requires `isVerified() && (existing().customerId == request.auth.uid || (request.auth.token.email == 'rizalfahriansyah03@gmail.com' && existing().storeScope == 'K4 Store_global'))`.

---

## 2. Example Payloads for the Eight Pillars of Hardened Rules

1. **Pillar 1 (Master Gate & Bounded Lists)**: No unbounded arrays are used in any document; line item summaries are bounded strings (`<= 800` chars).
2. **Pillar 2 (Validation Blueprints / Anti-Update-Gap)**: `isValidProduct(incoming())` and `isValidTransaction(incoming())` enforce `hasAll` + `hasOnly`, regex patterns, and boundary limits on both `create` and `update`.
3. **Pillar 3 (Path Variable Hardening)**: `isValidId(id)` enforces `id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')` on all single-document operations.
4. **Pillar 4 (Tiered Identity Logic)**: Tier 1 (`isAdmin()`) can edit catalog fields on `/products`; Tier 2 (`isVerified()`) can only decrement `stock` via `affectedKeys().hasOnly(['stock', 'updatedBy', 'updatedAt'])`.
5. **Pillar 5 (Total Array Guarding)**: `data.keys().hasOnly(...)` restricts all document fields to explicit static allowlists.
6. **Pillar 6 (PII Isolation)**: No raw PII (phone/address/email) is exposed in public collections; `/admins/{adminId}` only stores `uid`, `roleName`, and `createdAt`, readable only by the owner or an admin.
7. **Pillar 7 (Atomicity / Temporal Sync)**: Every mutation enforces `request.time` synchronization (`createdAt == request.time` on create, `updatedAt == request.time` on update).
8. **Pillar 8 (Secure List Queries)**: Every `allow list` rule evaluates `existing()` (`resource.data`) without invoking `get()` or `exists()`.

---

## 3. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Identity Spoofing on Transaction Create)**: Authenticated user `user_A` submits a transaction with `customerId: "user_B"`. -> `PERMISSION_DENIED` (`incoming().customerId == request.auth.uid` fails).
2. **Payload 2 (Self-Assigned Admin Privilege Escalation)**: Regular user `user_A` writes `/admins/user_A` with `{ uid: "user_A", roleName: "super_admin", createdAt: request.time }`. -> `PERMISSION_DENIED` (`isAdmin()` required to create `/admins`).
3. **Payload 3 (Unverified Email Spoofing Attack)**: Attacker authenticates with `email: "rizalfahriansyah03@gmail.com"` and `email_verified: false`, attempting to create a product. -> `PERMISSION_DENIED` (`isVerified()` checks `email_verified == true`).
4. **Payload 4 (Shadow / Ghost Field Injection on Product Update)**: Admin updates `/products/prod_1` with `{ ...validProduct, isFeaturedHack: true }`. -> `PERMISSION_DENIED` (`hasOnly` in `isValidProduct` rejects extra keys).
5. **Payload 5 (Customer Price Tampering via Stock Deduction Route)**: Customer updates `/products/prod_1` changing both `stock: 5` and `price: 1`. -> `PERMISSION_DENIED` (`affectedKeys().hasOnly(['stock', 'updatedBy', 'updatedAt'])` blocks `price` modification).
6. **Payload 6 (Customer Stock Inflation Attack)**: Customer updates `/products/prod_1` increasing `stock` from `10` to `999`. -> `PERMISSION_DENIED` (`incoming().stock < existing().stock` blocks increases by non-admins).
7. **Payload 7 (Terminal State Mutation on Completed Transaction)**: Customer updates `/transactions/tx_1` where `existing().status == 'completed'` to `status: 'cancelled'`. -> `PERMISSION_DENIED` (`existing().status == 'pending'` gate blocks mutation of terminal state).
8. **Payload 8 (Immutable Timestamp Forgery)**: Admin updates `/products/prod_1` and alters `createdAt` to a past timestamp. -> `PERMISSION_DENIED` (`incoming().createdAt == existing().createdAt` fails).
9. **Payload 9 (Client Timestamp Spoofing on Create)**: User creates `/transactions/tx_2` with `createdAt: Timestamp.fromMillis(1000000)`. -> `PERMISSION_DENIED` (`incoming().createdAt == request.time` fails).
10. **Payload 10 (ID Poisoning / Resource Exhaustion)**: User attempts `get` or `create` on `/transactions/invalid$id!with@special#chars`. -> `PERMISSION_DENIED` (`isValidId` regex `^[a-zA-Z0-9_\-]+$` fails).
11. **Payload 11 (Value Poisoning on Whitelisted Key)**: Customer updates `stock` on `/products/prod_1` with a string `"ten"` or negative `-5`. -> `PERMISSION_DENIED` (`isValidProduct` enforces `data.stock is number && data.stock >= 0`).
12. **Payload 12 (Unauthorized Blanket List Scraping on Transactions)**: Regular user `user_A` runs an unconstrained `getDocs(collection(db, 'transactions'))` without filtering by `customerId == 'user_A'`. -> `PERMISSION_DENIED` (`allow list` requires `existing().customerId == request.auth.uid`).

---

## 4. Red Team Conflict Report

| Collection | Identity Spoofing | State Shortcutting | Resource / Value Poisoning | `isValid[Entity]` in Update | Audit Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/admins/{adminId}` | Blocked (`uid == adminId`, admin-only write) | Blocked (enum role check) | Blocked (`maxLength`, regex check) | Present at top of `allow update` | **PASS** |
| `/products/{productId}` | Blocked (`updatedBy == request.auth.uid`) | Blocked (non-admin can only decrement `stock`) | Blocked (`maxLength`, regex, non-negative numbers) | Present at top of `allow update` | **PASS** |
| `/transactions/{transactionId}` | Blocked (`customerId == request.auth.uid`) | Blocked (Terminal State Locking on `status`) | Blocked (`maxLength`, regex, numeric bounds) | Present at top of `allow update` | **PASS** |
