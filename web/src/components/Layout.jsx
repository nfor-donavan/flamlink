import { NavLink, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import Toggles from './Toggles';
import { session } from '../lib/api';
import { usePrefs } from '../lib/i18n';

const I = (d) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const LINKS = [
  ['/', 'Overview', 'M3 12l9-9 9 9M5 10v10h14V10'],
  ['/depots', 'Depots', 'M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6'],
  ['/assets', 'Cylinders', 'M8 6a4 4 0 018 0v14a1 1 0 01-1 1H9a1 1 0 01-1-1zM10 2h4M8 11h8'],
  ['/dispatch', 'Dispatch', 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z'],
  ['/handovers', 'Handovers', 'M7 7h13l-4-4M17 17H4l4 4'],
  ['/accounts', 'Accounts & prices', 'M4 6h16v12H4zM4 10h16M8 15h3'],
];

export default function Layout({ children }) {
  const nav = useNavigate();
  const { t } = usePrefs();
  const s = session.get();
  return (
    <div className="shell">
      <aside className="side">
        <Logo light />
        <nav className="nav" aria-label={t('Main')}>
          {LINKS.map(([to, label, d]) => <NavLink key={to} to={to} end={to === '/'}>{I(d)}{t(label)}</NavLink>)}
        </nav>
        <div className="side-foot">
          <Toggles onDark />
          <b>{s.tenant.name}</b>{s.user.name} ({t(s.user.role)})
          <div><button onClick={() => { session.clear(); nav('/login'); }}>{t('Sign out')}</button></div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
