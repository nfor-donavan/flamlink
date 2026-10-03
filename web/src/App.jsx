import { Navigate, Route, Routes } from 'react-router-dom';
import { session } from './lib/api';
import { usePrefs } from './lib/i18n';
import Layout from './components/Layout';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Depots from './pages/Depots';
import Assets from './pages/Assets';
import Dispatch from './pages/Dispatch';
import Handovers from './pages/Handovers';
import Accounts from './pages/Accounts';

function Protected({ children }) {
  const s = session.get();
  const { t } = usePrefs();
  if (!s) return <Navigate to="/login" replace />;
  if (!['owner', 'manager'].includes(s.user.role)) {
    return <div className="login-form"><div className="card"><h2>{t('This dashboard is for managers')}</h2><p>{t('Drivers and retailers use the Flamlink mobile app.')}</p><button className="btn" onClick={() => { session.clear(); location.assign('/login'); }}>{t('Sign out')}</button></div></div>;
  }
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Overview /></Protected>} />
      <Route path="/depots" element={<Protected><Depots /></Protected>} />
      <Route path="/assets" element={<Protected><Assets /></Protected>} />
      <Route path="/dispatch" element={<Protected><Dispatch /></Protected>} />
      <Route path="/handovers" element={<Protected><Handovers /></Protected>} />
      <Route path="/accounts" element={<Protected><Accounts /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
