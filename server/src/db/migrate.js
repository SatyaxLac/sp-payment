const pool = require('./index');

const createTables = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name        VARCHAR(100) NOT NULL,
            email       VARCHAR(100) UNIQUE NOT NULL,
            password    VARCHAR(255) NOT NULL,
            created_at  TIMESTAMP DEFAULT NOW()
        );


        CREATE TABLE IF NOT EXISTS wallets (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     UUID UNIQUE NOT NULL REFERENCES users(id),
            balance     NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
            currency    VARCHAR(3) NOT NULL DEFAULT 'INR',
            status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
            created_at  TIMESTAMP DEFAULT NOW(),
            CONSTRAINT balance_non_negative CHECK (balance >= 0),
            CONSTRAINT valid_status CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED'))
        );
        

        CREATE TABLE IF NOT EXISTS transactions (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            idempotency_key VARCHAR(255) UNIQUE,
            sender_id       UUID NOT NULL REFERENCES users(id),
            receiver_id     UUID NOT NULL REFERENCES users(id),
            amount          NUMERIC(12, 2) NOT NULL,
            status          VARCHAR(20) NOT NULL DEFAULT 'INITIATED',
            failure_reason  TEXT,
            created_at      TIMESTAMP DEFAULT NOW(),
            updated_at      TIMESTAMP DEFAULT NOW(),
            CONSTRAINT amount_positive CHECK (amount > 0),
            CONSTRAINT valid_status CHECK (status IN (
                'INITIATED', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED'
            ))
        );


        CREATE TABLE IF NOT EXISTS ledger_entries (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            transaction_id  UUID NOT NULL REFERENCES transactions(id),
            user_id         UUID NOT NULL REFERENCES users(id),
            amount          NUMERIC(12, 2) NOT NULL,
            entry_type      VARCHAR(10) NOT NULL,
            created_at      TIMESTAMP DEFAULT NOW(),
            CONSTRAINT valid_entry_type CHECK (entry_type IN ('DEBIT', 'CREDIT'))
        );


        CREATE INDEX IF NOT EXISTS idx_transactions_sender ON transactions(sender_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_receiver ON transactions(receiver_id);
        CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_entries(user_id);
  
    `);

    console.log('Tables created successfully');
        process.exit(0);
};
        
            
createTables().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});