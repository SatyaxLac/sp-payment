import { useState } from 'react';
import api from '../api';

export default function Auth({ onLogin }) {
  const [mode, setMode]       = useState('login'); // 'login' | 'register'
  const [form, setForm]       = useState({ name: '', email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const { data } = await api.post(endpoint, form);
      onLogin(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 40,
        width: '100%',
        maxWidth: 400,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700 }}>₹ Sp Payment</h1>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginTop: 4 }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'register' && (
            <input
              name="name"
              placeholder="Full name"
              value={form.name}
              onChange={handle}
            />
          )}
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handle}
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handle}
          />

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>
          )}

          <button
            onClick={submit}
            disabled={loading}
            style={{
              background: 'var(--primary)',
              color: '#fff',
              padding: '11px 0',
              marginTop: 4,
              fontSize: 15,
            }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 15, color: 'var(--muted)' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have one? '}
          <span
            onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}
            style={{ color: 'var(--primary)', cursor: 'pointer' }}
          >
            {mode === 'login' ? 'Register' : 'Sign In'}
          </span>
        </p>
      </div>
    </div>
  );
}