import { useState, useEffect } from 'react';
import Auth from './screens/Auth';
import Dashboard from './screens/Dashboard';
import History from './screens/History';

export default function App() {
  const [screen, setScreen] = useState('auth');
  const [user, setUser]     = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      setUser(JSON.parse(stored));
      setScreen('dashboard');
    }
  }, []);

  const handleLogin = (userData) => {
    localStorage.setItem('token', userData.token);
    localStorage.setItem('user', JSON.stringify(userData.user));
    setUser(userData.user);
    setScreen('dashboard');
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setScreen('auth');
  };

  if (screen === 'auth') return <Auth onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: '100vh' }}>
      <Nav screen={screen} setScreen={setScreen} onLogout={handleLogout} />
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
        {screen === 'dashboard' && <Dashboard user={user} />}
        {screen === 'history'   && <History />}
      </main>
    </div>
  );
}

function Nav({ screen, setScreen, onLogout }) {
  return (
    <nav style={{
      borderBottom: '1px solid var(--border)',
      padding: '0 40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 68,
      background: 'var(--surface)',
    }}>
      {/* Logo */}
      <span style={{
        fontWeight: 800,
        fontSize: 32,
        color: 'var(--primary)',
        letterSpacing: '-0.5px',
      }}>
        ₹ Sp Payment
      </span>

      {/* Nav tabs + logout */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {['dashboard', 'history'].map(s => (
          <button
            key={s}
            onClick={() => setScreen(s)}
            style={{
              background: screen === s ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: screen === s ? 'var(--primary)' : 'var(--muted)',
              padding: '8px 18px',
              fontSize: 15,
              fontWeight: screen === s ? 600 : 400,
              textTransform: 'capitalize',
              borderRadius: 8,
            }}
          >
            {s}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 8px' }} />
        <button
          onClick={onLogout}
          style={{
            background: 'transparent',
            color: 'var(--muted)',
            padding: '8px 14px',
            fontSize: 14,
            borderRadius: 8,
          }}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}