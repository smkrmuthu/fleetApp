import { useState } from 'react';
import { DEMO_ACCOUNTS } from '../data/mockData';

interface Props {
  onSignIn: (phone: string, password: string) => Promise<void>;
}

export function SignIn({ onSignIn }: Props) {
  const [phone, setPhone] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function attempt(p: string, pw: string) {
    setError('');
    setBusy(true);
    try {
      await onSignIn(p, pw);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
      <div style={{ background: 'var(--color-accent)', color: '#fff', padding: '56px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100vh' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Fleet Ledger</div>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 'clamp(34px, 4.4vw, 62px)', lineHeight: 0.98, letterSpacing: '-0.03em' }}>
            Every trip,<br />every rupee,<br />one ledger.
          </div>
          <div style={{ height: 2, background: '#fff', opacity: 0.6, margin: '28px 0 20px', maxWidth: 340 }} />
          <div style={{ fontSize: 15, lineHeight: 1.6, maxWidth: '44ch' }}>
            Drivers log the movement and the fuel as they go, however many days it takes. Documentation posts the fixed costs. The manager closes the month — from the same numbers.
          </div>
        </div>
        <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.85 }}>Meridian Logistics · Chennai &amp; Cochin</div>
      </div>

      <div style={{ padding: '56px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 560 }}>
        <h1 style={{ fontSize: 32, letterSpacing: '-0.02em', margin: '0 0 6px' }}>Sign in</h1>
        <p style={{ color: 'var(--color-neutral-700)', margin: '0 0 28px' }}>Use the mobile number registered with your branch.</p>

        <form
          style={{ display: 'grid', gap: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            attempt(phone, pass);
          }}
        >
          <div className="field">
            <label>Mobile number</label>
            <input className="input" type="tel" placeholder="+91 98xxx xxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" placeholder="••••••••" value={pass} onChange={(e) => setPass(e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" defaultChecked />
            <span>Keep me signed in on this device</span>
          </label>
          {error && <div style={{ color: 'var(--color-accent-700)', fontSize: 13 }}>{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <a href="#reset">Forgot password</a>
            <a href="#otp">Sign in with OTP instead</a>
          </div>
        </form>

        <div style={{ marginTop: 36, borderTop: '2px solid var(--color-divider)', paddingTop: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-700)', marginBottom: 12 }}>
            Demo — sign in as
          </div>
          <div style={{ display: 'grid', gap: 2, background: 'var(--color-divider)', border: '2px solid var(--color-divider)' }}>
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.key}
                type="button"
                disabled={busy}
                onClick={() => attempt(a.phone, a.password)}
                style={{
                  appearance: 'none', border: 0, background: 'var(--color-bg)', textAlign: 'left',
                  padding: '13px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                  gap: 14, alignItems: 'baseline', fontFamily: 'var(--font-body)', fontSize: 14
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-100)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-bg)')}
              >
                <span style={{ fontWeight: 600 }}>{a.name}</span>
                <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>{a.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
