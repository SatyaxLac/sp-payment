# Sp Payment — Project Guidelines, Architecture & Conventions

This document summarizes the architectural patterns, coding standards, key modules, and database conventions for **Sp Payment System**. Refer to this guide to maintain consistency across codebase modifications.

---

## 1. High-Level Architecture Overview

**flo-payments** consists of three decoupled services:

1. **`server` (Port 3000)**: Main backend API written in Node.js/Express. Interacts directly with PostgreSQL via raw `pg` queries.
2. **`mock-bank` (Port 4000)**: Independent simulation server mimicking external core banking APIs. Processes debit requests with simulated network delay (2s) and 80/20 chaos testing, returning status updates via HMAC-signed webhooks.
3. **`client` (Port 5173)**: React SPA built with Vite, styled via custom CSS variables and inline styles.

---

## 2. Core Architectural & Financial Patterns

### Double-Entry Ledger
* **`wallets.balance`**: Acts as a high-performance read cache for fast balance lookups.
* **`ledger_entries`**: Serves as the immutable source of truth for financial auditing.
* **Rule**: Every settled transaction MUST create paired ledger entries:
  * `DEBIT`: Negative amount (`-amount`) for sender.
  * `CREDIT`: Positive amount (`+amount`) for receiver.
* **Integrity**: `SUM(amount)` across all `ledger_entries` must equal `0` (audited via `/api/wallet/ledger-check`).

### Concurrency Control & Row Locking (`SELECT FOR UPDATE`)
* Application-level balance checks are vulnerable to race conditions under concurrent requests.
* **Rule**: Settlement logic in `webhookController.js` locks both wallet rows in PostgreSQL before mutating balances:
  ```sql
  SELECT id FROM wallets WHERE user_id = ANY($1::uuid[]) FOR UPDATE
  ```
* **Deadlock Prevention**: Always sort target `user_id` UUIDs deterministically (`[sender_id, receiver_id].sort()`) before locking.

### State Machine-Enforced Lifecycle
Valid transaction status transitions are strictly enforced in `server/src/utils/stateMachine.js`:
$$\text{INITIATED} \longrightarrow \text{PENDING} \longrightarrow \text{PROCESSING} \longrightarrow \begin{cases} \text{SUCCESS} \longrightarrow \text{REVERSED} \\ \text{FAILED} \end{cases}$$
* **Rule**: Never update `transactions.status` directly without passing through `transition(currentStatus, nextStatus)`.

### Webhook Signature Verification (HMAC-SHA256)
* Webhooks sent from `mock-bank` contain an `x-bank-signature` header.
* **Rule**: Verify payload authenticity using `crypto.timingSafeEqual` with shared secret `mock_bank_webhook_secret` prior to processing settlement or modifying database state.

### Idempotency Guarantee
* Financial endpoints (`POST /api/transactions/transfer`) intercept requests via `idempotency.js` middleware using the `idempotency-key` header/body parameter.
* **Rule**: If an idempotency key already exists in `transactions`, short-circuit execution and return the existing record with HTTP 200.

---

## 3. Database Schema Conventions

All DDL scripts live in `server/src/db/migrate.js`.

* **Primary Keys**: UUID default generated (`gen_random_uuid()`).
* **Foreign Keys**: Explicit `REFERENCES` with ON DELETE default restrictions.
* **Check Constraints**:
  * `wallets.balance >= 0` (`balance_non_negative`)
  * `transactions.amount > 0` (`amount_positive`)
  * Valid state enums checked at DB layer (`valid_status`, `valid_entry_type`).
* **No ORM Rule**: Write raw SQL queries. Do not add Prisma, TypeORM, or Sequelize.

---

## 4. Code Style & Technical Conventions

### Backend (Node.js / Express)
* **Module System**: CommonJS (`require` / `module.exports`).
* **Database Pool**: Use `pool.connect()` and acquire a `client` for multi-statement SQL transactions.
* **Transaction Safety**: Always wrap DB transactions in `try / catch / finally` blocks and call `client.release()` in `finally`.
  ```javascript
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // DB logic
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  ```
* **HTTP Status Codes**:
  * `200 OK`: Successful synchronous operations & duplicate idempotency hits.
  * `201 Created`: User registration.
  * `202 Accepted`: Asynchronous transfer initiation (pending bank webhook).
  * `400 Bad Request`: Validation errors or invalid balance/input.
  * `401 Unauthorized`: Invalid/missing JWT token or invalid HMAC signature.
  * `404 Not Found`: Recipient/Transaction not found.
  * `409 Conflict`: Duplicate registration email.
  * `500 Internal Server Error`: Uncaught processing failures.

### Frontend (React 18 + Vite)
* **Module System**: ES Modules (`import` / `export default`).
* **API Client**: Axios instance configured in `client/src/api.js` with auto-attached `Authorization: Bearer <token>` interceptor.
* **State & Polling**: Functional components using standard React hooks (`useState`, `useEffect`, `useCallback`). Status updates for pending payments use client-side interval polling (800ms frequency with a max 10-attempt cap).
* **Styling**: Vanilla CSS tokens defined in `index.css` (`var(--primary)`, `var(--surface)`, `var(--border)`, `var(--muted)`, `var(--success)`, `var(--danger)`).

---

## 5. Key Modules Map

| Path | Description |
| :--- | :--- |
| [`server/src/db/migrate.js`](file:///c:/Users/satya/OneDrive/Desktop/flo-payments/server/src/db/migrate.js) | PostgreSQL tables, indexes, and check constraints DDL. |
| [`server/src/utils/stateMachine.js`](file:///c:/Users/satya/OneDrive/Desktop/flo-payments/server/src/utils/stateMachine.js) | Transaction state transition map & validator function. |
| [`server/src/middleware/auth.js`](file:///c:/Users/satya/OneDrive/Desktop/flo-payments/server/src/middleware/auth.js) | Express middleware verifying JWT tokens from Authorization header. |
| [`server/src/middleware/idempotency.js`](file:///c:/Users/satya/OneDrive/Desktop/flo-payments/server/src/middleware/idempotency.js) | Intercepts duplicate transfer requests by checking `idempotency_key`. |
| [`server/src/controllers/transferController.js`](file:///c:/Users/satya/OneDrive/Desktop/flo-payments/server/src/controllers/transferController.js) | Handles transfer initiation, checks sender balance, fires mock bank request. |
| [`server/src/controllers/webhookController.js`](file:///c:/Users/satya/OneDrive/Desktop/flo-payments/server/src/controllers/webhookController.js) | HMAC signature verification & ACID transaction settlement (`SELECT FOR UPDATE`). |
| [`server/src/routes/wallet.js`](file:///c:/Users/satya/OneDrive/Desktop/flo-payments/server/src/routes/wallet.js) | `/me` wallet endpoint & `/ledger-check` double-entry audit endpoint. |
| [`mock-bank/src/index.js`](file:///c:/Users/satya/OneDrive/Desktop/flo-payments/mock-bank/src/index.js) | Simulates bank debit processing, 2s latency, 80/20 chaos testing, HMAC signing. |
| [`client/src/screens/Dashboard.jsx`](file:///c:/Users/satya/OneDrive/Desktop/flo-payments/client/src/screens/Dashboard.jsx) | React wallet UI: available balance, send money form, status polling & ledger health. |
