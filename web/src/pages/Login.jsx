import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, session } from '../lib/api';
import { usePrefs } from '../lib/i18n';
import { Logo } from '../components/Logo';
import Toggles from '../components/Toggles';
import { Field } from '../components/ui';

export default function Login() {
  const nav = useNavigate(); const { t } = usePrefs();
  const [f, setF] = useState({ identifier: '', password: '', tenantSlug: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const data = await api('/auth/login', { method: 'POST', body: { ...f, tenantSlug: f.tenantSlug || undefined } });
      session.set(data); nav('/');
    } catch (x) { setErr(t(x.message)); } finally { setBusy(false); }
  };
  return (
    <div className="login">
      <section className="login-art">
        <div className="row" style={{ justifyContent: 'space-between' }}><Logo light /><Toggles onDark /></div>
        <div>
          <div className="price-tag"><s>9 000</s><b>6 500 XAF</b></div>
          <h1>{t('Every cylinder. Every depot. No shortage.')}</h1>
          <p>{t('Follow each steel bottle from the filling plant to the neighbourhood shop, keep retail prices honest, and send a truck before a depot runs dry.')}</p>
        </div>
        <span className="sub">{t('Built for gas distributors in Cameroon')}</span>
      </section>
      <section className="login-form">
        <form onSubmit={submit}>
          <h2>{t('Sign in to your distributor account')}</h2>
          <Field label={t('Email or phone')}><input autoFocus value={f.identifier} onChange={(e) => setF({ ...f, identifier: e.target.value })} required /></Field>
          <Field label={t('Password')}><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
          <Field label={t('Company code (only if asked)')}><input value={f.tenantSlug} onChange={(e) => setF({ ...f, tenantSlug: e.target.value })} placeholder="gaz-capitale" /></Field>
          {err && <div className="error" role="alert">{err}</div>}
          <button className="btn" disabled={busy}>{busy ? t('Signing in…') : t('Sign in')}</button>
        </form>
      </section>
    </div>
  );
}
