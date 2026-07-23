import { useState, useEffect } from 'react';
import api from '../api';

const STATUS_COLORS = {
  SUCCESS:    { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e' },
  FAILED:     { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444' },
  PENDING:    { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b' },
  PROCESSING: { bg: 'rgba(99,102,241,0.1)', color: '#6366f1' },
  INITIATED:  { bg: 'rgba(100,116,139,0.1)', color: '#64748b' },
  REVERSED:   { bg: 'rgba(168,85,247,0.1)',  color: '#a855f7' },
};

export default function History() {
  const [txns, setTxns]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/transactions/history')
      .then(({ data }) => setTxns(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <p style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 60 }}>
      Loading...
    </p>
  );

  if (txns.length === 0) return (
    <p style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 60 }}>
      No transactions yet.
    </p>
  );

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Transaction History</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
          {txns.length} transaction{txns.length !== 1 ? 's' : ''}
        </p>
      </div>

      {txns.map((tx, i) => {
        const sent = tx.direction === 'SENT';
        const style = STATUS_COLORS[tx.status] || STATUS_COLORS.INITIATED;

        return (
          <div
            key={tx.id}
            style={{
              padding: '16px 24px',
              borderBottom: i < txns.length - 1 ? '1px solid var(--border)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            {/* Left — direction icon + names */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: sent ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>
                {sent ? '↑' : '↓'}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500 }}>
                  {sent ? `To ${tx.receiver_name}` : `From ${tx.sender_name}`}
                </p>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {new Date(tx.created_at).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </p>
                {tx.failure_reason && (
                  <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>
                    {tx.failure_reason}
                  </p>
                )}
              </div>
            </div>

            {/* Right — amount + status badge */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{
                fontSize: 16, fontWeight: 600,
                color: sent ? 'var(--danger)' : 'var(--success)',
              }}>
                {sent ? '−' : '+'}₹{parseFloat(tx.amount).toLocaleString('en-IN')}
              </p>
              <span style={{
                display: 'inline-block',
                marginTop: 4,
                padding: '2px 8px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 500,
                background: style.bg,
                color: style.color,
              }}>
                {tx.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}