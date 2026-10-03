import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { usePrefs } from '../lib/i18n';
import { ago, xaf } from '../lib/format';
import { Empty } from '../components/ui';

export default function Handovers() {
  const { t } = usePrefs();
  const [rows, setRows] = useState([]); const [bad, setBad] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { api('/handovers', { params: { unbalanced: bad ? 'true' : '', limit: 80 } }).then(setRows).catch((e) => setErr(t(e.message))); }, [bad]); // eslint-disable-line
  const pm = { Cash: 'Cash', MoMo: 'MTN MoMo', Orange_Money: 'Orange Money' };
  return (
    <>
      <div className="page-head"><div><h1>{t('Handovers')}</h1><p>{t('Every full-for-empty exchange made by your drivers.')}</p></div></div>
      <div className="tabs"><button className={!bad ? 'on' : ''} onClick={() => setBad(false)}>{t('All')}</button><button className={bad ? 'on' : ''} onClick={() => setBad(true)}>{t('With missing shells')}</button></div>
      {err && <div className="error">{err}</div>}
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>{t('When')}</th><th>{t('Driver')}</th><th>{t('Depot')}</th><th className="num">{t('Full in')}</th><th className="num">{t('Empty out')}</th><th className="num">{t('Cash')}</th><th>{t('Result')}</th></tr></thead>
        <tbody>{rows.map((h) => (
          <tr key={h._id}><td className="sub">{ago(h.createdAt, t)}</td><td>{h.driverId && h.driverId.name}</td>
            <td><strong>{h.depotId && h.depotId.shopName}</strong><div className="sub">{h.depotId && h.depotId.neighborhood}</div></td>
            <td className="num">{h.cylindersDelivered.length}</td><td className="num">{h.cylindersCollected.length}</td>
            <td className="num">{xaf(h.cashCollectedXAF)}<div className="sub">{pm[h.paymentMethod]}{h.cashShortfallXAF ? ` · ${t('short')} ${xaf(h.cashShortfallXAF)}` : ''}</div></td>
            <td>{h.balanced ? <span className="pill" style={{ '--c': '#1E9E6A' }}>{t('Balanced')}</span> : <span className="pill" style={{ '--c': '#E4572E' }}>{t('{n} missing, charged {amount}', { n: h.deficitCount, amount: xaf(h.deficitChargeXAF) })}</span>}</td></tr>))}</tbody></table>
        {!rows.length && <Empty>{t('No handovers yet.')}</Empty>}</div></div>
    </>
  );
}
