import { useState } from 'react';
import logoMarkWhite from '../assets/logo-mark-white.png';
import logoFullWhite from '../assets/logo-full-white.png';

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
    <div className="sign-in-grid">
      <div className="sign-in-brand" style={{ background: 'var(--color-accent)', color: '#fff' }}>
        <img src={logoMarkWhite} alt="" className="sign-in-watermark" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <img src={logoFullWhite} alt="Shree Mira Trader" style={{ height: 64, width: 'auto' }} />
          <div style={{ width: 2, alignSelf: 'stretch', background: '#fff', opacity: 0.6 }} />
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Fleet Ledger</div>
        </div>
        <div style={{ alignSelf: 'center' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 'clamp(32px, 6.4vw, 72px)', lineHeight: 1.02, letterSpacing: '-0.03em' }}>
            Every trip, every rupee, one ledger.
          </div>
          <div style={{ height: 2, background: '#fff', opacity: 0.6, margin: '24px 0 18px', maxWidth: 340 }} />
          <div style={{ fontSize: 15, lineHeight: 1.6, maxWidth: '44ch' }}>
            Track every trip, fuel stop, and expense across your fleet — from the road to the ledger, in one place for your whole team.
          </div>
        </div>
        <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.85 }}>Shree Mira Trader · Chennai &amp; Cochin</div>
      </div>

      <div className="sign-in-form-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h1 style={{ fontSize: 32, letterSpacing: '-0.02em', margin: '0 0 6px' }}>Sign in</h1>
        <p style={{ color: 'var(--color-neutral-700)', margin: '0 0 28px' }}>Sign in with your registered account credentials.</p>

        <form
          style={{ display: 'grid', gap: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            attempt(phone, pass);
          }}
        >
          <div className="field">
            <label>Email or Mobile number</label>
            <input className="input" type="text" placeholder="name@smt.com" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
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
      </div>
    </div>
  );
}
