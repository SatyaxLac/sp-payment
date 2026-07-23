# Sp Payment — Payment System

A full-stack payment system built as **Sp Payment** to understand how real payment infrastructure works under the hood — focusing on the core backend architecture, transaction processing, and auditing mechanisms that power modern digital payment platforms like PhonePe and Paytm.

---

## Highlights & Core Architecture

Most payment application projects focus primarily on basic UI elements and treat backend transaction flows as a simplified black box. This project places production-grade backend engineering at its center:

- **Atomic Wallet Transfers**: Uses PostgreSQL ACID transactions with deterministic row-level locking (`SELECT FOR UPDATE`), guaranteeing concurrent transfers from the same wallet never cause race conditions or negative balances.
- **Double-Entry Bookkeeping Ledger**: Every transaction automatically generates balanced paired ledger records (debit and credit) that always sum to zero, establishing an immutable audit trail.
- **State Machine-Enforced Lifecycle**: Transaction states (`INITIATED` $\rightarrow$ `PENDING` $\rightarrow$ `PROCESSING` $\rightarrow$ `SUCCESS` / `FAILED`) are programmatically validated, preventing invalid state jumps.
- **Asynchronous Bank Settlement via Webhooks**: Transfers do not settle synchronously; a dedicated mock bank service processes the debit asynchronously and triggers balance updates via signed HTTP webhooks.
- **HMAC-SHA256 Signature Verification**: Webhook callbacks are verified using timing-safe HMAC signature checks before any database balances or ledger records are updated.
- **Idempotency Protection**: Duplicate payment requests (due to network retries or double taps) are intercepted using unique idempotency keys before executing database writes.
- **Real-Time Ledger Audit Check**: A `/ledger-check` endpoint verifies that total debits and credits across the ledger remain strictly balanced at $\sum(\text{amount}) = 0$.

---

## Transaction Lifecycle & Sequence

```
POST /api/transactions/transfer
  │
  ├─ Validate request payload + check idempotency key
  ├─ Create transaction record → INITIATED
  ├─ Dispatch debit request to mock bank server → PENDING
  └─ Return 202 Accepted immediately to client

          [~2 seconds later]

POST /api/webhooks/bank  ← Called asynchronously by mock bank
  │
  ├─ Verify HMAC-SHA256 webhook signature
  ├─ Check current transaction state (ignore duplicates)
  ├─ BEGIN SQL Transaction
  │   ├─ Lock sender and receiver wallet rows (SELECT FOR UPDATE)
  │   ├─ Debit sender wallet, credit receiver wallet
  │   ├─ Write paired double-entry ledger entries (DEBIT & CREDIT)
  │   └─ Update transaction status → SUCCESS or FAILED
  └─ COMMIT SQL Transaction
```

---

## Transaction State Machine

```
INITIATED → PENDING → PROCESSING → SUCCESS
                              ↘ FAILED
                  ↘ FAILED
SUCCESS → REVERSED
```

Invalid state transitions throw application-level exceptions before attempting any database operations.

---

## Tech Stack

| Layer | Technology | Engineering Rationale |
| :--- | :--- | :--- |
| **Project Name** | Sp Payment | Official project name |
| **Backend** | Node.js + Express | Explicit routing and SQL control without heavy ORM abstractions |
| **Database** | PostgreSQL (Neon / Local) | ACID compliance, row locking (`SELECT FOR UPDATE`), check constraints |
| **Frontend** | React 18 + Vite | Modern SPA dashboard with custom CSS variables & glassmorphism styling |
| **Security & Auth** | JWT + bcryptjs + HMAC | Stateless authorization, password hashing, and webhook signing |
| **Mock Bank** | Express (Port 4000) | Standalone server simulating interbank delays and webhook callbacks |

---

## Running Locally

### Prerequisites
- Node.js (v18+)
- PostgreSQL database instance

### Quickstart

```bash
# Clone the repository
git clone https://github.com/Tanmay-boop-hash/flo-payments.git
cd flo-payments

# 1. Start Server Backend (Port 3000)
cd server
npm install
cp .env.example .env   # configure PORT, DATABASE_URL, JWT_SECRET, MOCK_BANK_URL
npm run migrate        # create tables and indexes
npm run dev

# 2. Start Mock Bank Simulator (Separate Terminal - Port 4000)
cd mock-bank
npm install
npm run dev

# 3. Start Client Frontend (Separate Terminal - Port 5173)
cd client
npm install
npm run dev
```

---

## API Endpoints Reference

### Auth
```
POST /api/auth/register     { name, email, password }
POST /api/auth/login        { email, password }
```

### Wallet & Ledger
```
GET  /api/wallet/me              → balance, currency, status
GET  /api/wallet/ledger-check    → double-entry audit check
```

### Transactions
```
POST /api/transactions/transfer  { receiver_email, amount, idempotency_key }
GET  /api/transactions/history   → full transaction audit log for user
GET  /api/transactions/:id       → fetch single transaction by UUID
```

### Webhooks
```
POST /api/webhooks/bank          → receives signed settlement callbacks from bank
```

---
