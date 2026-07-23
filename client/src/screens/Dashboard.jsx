import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import api from '../api';

export default function Dashboard({ user }) {
  const [wallet, setWallet]   = useState(null);
  const [ledger, setLedger]   = useState(null);
  const [form, setForm]       = useState({ receiver_email: '', amount: '' });
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState(null);
  // txStatus shape: { type: 'pending'|'success'|'failed', msg, txId }

  const fetchWallet = useCallback(async () => {
    const { data } = await api.get('/wallet/me');
    setWallet(data);
  }, []);

  const fetchLedger = useCallback(async () => {
    const { data } = await api.get('/wallet/ledger-check');
    setLedger(data);
  }, []);

  useEffect(() => {
    fetchWallet();
    fetchLedger();
  }, [fetchWallet, fetchLedger]);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async () => {
    if (!form.receiver_email || !form.amount) return;
    setLoading(true);
    setTxStatus(null);

    try {
      const { data } = await api.post('/transactions/transfer', {
        receiver_email: form.receiver_email,
        amount: parseFloat(form.amount),
        idempotency_key: uuidv4(),
      });

      const txId = data.transaction_id;
      const amountSent = parseFloat(form.amount);  // save before clearing form
      setTxStatus({ type: 'pending', msg: 'Contacting bank...', txId });
      setForm({ receiver_email: '', amount: '' });

      // Poll transaction status until it settles
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const { data: tx } = await api.get(`/transactions/${txId}`);

          if (tx.status === 'SUCCESS') {
            clearInterval(poll);
            await fetchWallet();
            await fetchLedger();
            setTxStatus({ type: 'success', msg: `₹${amountSent.toLocaleString('en-IN')} sent successfully`, txId });
            // Auto-clear after 5 seconds
            setTimeout(() => setTxStatus(null), 5000);
          } else if (tx.status === 'FAILED') {
            clearInterval(poll);
            await fetchWallet();
            setTxStatus({ type: 'failed', msg: tx.failure_reason || 'Bank declined the transaction', txId });
            setTimeout(() => setTxStatus(null), 5000);
          }
        } catch (err) {
          // Log polling errors so they don't fail silently
          // but don't interrupt the polling loop for transient errors
          console.error('Transaction poll error:', err);
        }

        if (attempts >= 10) {
          clearInterval(poll);
          setTxStatus({ type: 'failed', msg: 'No response from bank — check history', txId });
          setTimeout(() => setTxStatus(null), 5000);
        }
      }, 800);

    } catch (err) {
      setTxStatus({
        type: 'failed',
        msg: err.response?.data?.error || 'Transfer failed',
        txId: null
      });
      setTimeout(() => setTxStatus(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning!' : hour < 17 ? 'Good afternoon!' : 'Good evening!';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Greeting */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ color: 'var(--muted)', fontSize: 16 }}>{greeting}</p>
        <h1 style={{ fontSize: 26, fontWeight: 500, marginTop: 2 }}>
          {user?.name?.split(' ')[0]}
        </h1>
      </div>

      {/* Wallet Balance Card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '28px 32px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ color: 'var(--muted)', fontSize: 18, marginBottom: 6 }}>
            Available balance
          </p>
          <p style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-1px', lineHeight: 1 }}>
            ₹{wallet
              ? parseFloat(wallet.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })
              : '—'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 600,
            background: 'rgba(34,197,94,0.1)',
            color: 'var(--success)',
            letterSpacing: '0.5px',
          }}>
            {wallet?.status || 'ACTIVE'}
          </span>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
            {wallet?.currency || 'INR'} wallet
          </p>
        </div>
      </div>

      {/* Send Money */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '28px 32px',
      }}>
        <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 20, color: 'var(--text)' }}>
          Send money
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Recipient field */}
          <div>
            <label style={{ fontSize: 16, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
              Recipient email
            </label>
            <input
              name="receiver_email"
              type="email"
              placeholder="xyz@gmail.com"
              value={form.receiver_email}
              onChange={handle}
            />
          </div>

          {/* Amount field */}
          <div>
            <label style={{ fontSize: 16, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
              Amount
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted)', fontSize: 14, pointerEvents: 'none',
              }}>
                ₹
              </span>
              <input
                name="amount"
                type="number"
                placeholder="0.00"
                value={form.amount}
                onChange={handle}
                min="1"
                style={{ paddingLeft: 28 }}
              />
            </div>
          </div>

          {/* Status banner */}
          {txStatus && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 10,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: txStatus.type === 'success'
                ? 'rgba(34,197,94,0.1)'
                : txStatus.type === 'failed'
                ? 'rgba(239,68,68,0.1)'
                : 'rgba(245,158,11,0.1)',
              border: `1px solid ${txStatus.type === 'success'
                ? 'rgba(34,197,94,0.25)'
                : txStatus.type === 'failed'
                ? 'rgba(239,68,68,0.25)'
                : 'rgba(245,158,11,0.25)'}`,
              color: txStatus.type === 'success'
                ? 'var(--success)'
                : txStatus.type === 'failed'
                ? 'var(--danger)'
                : 'var(--warning)',
            }}>
              <span style={{ fontSize: 16 }}>
                {txStatus.type === 'success' ? '✓' : txStatus.type === 'failed' ? '✕' : '◌'}
              </span>
              <span>{txStatus.msg}</span>
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading || !form.receiver_email || !form.amount}
            style={{
              background: 'var(--primary)',
              color: '#fff',
              padding: '13px 0',
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 10,
              marginTop: 4,
              letterSpacing: '0.2px',
            }}
          >
            {loading ? 'Initiating...' : 'Send payment'}
          </button>

        </div>
      </div>

      {/* Ledger health — subtle strip at the bottom */}
      {ledger && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderRadius: 10,
          background: 'transparent',
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: ledger.balanced ? 'var(--success)' : 'var(--danger)',
            }} />
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>
              {ledger.balanced ? 'Ledger balanced' : 'Ledger imbalance detected'}
            </span>
          </div>
          <span style={{ fontSize: 14, color: 'var(--muted)' }}>
            {ledger.entry_count} entries · ₹{Math.abs(ledger.total_credits).toLocaleString('en-IN')} credited
          </span>
        </div>
      )}

    </div>
  );
}