import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { usePrefs } from '../lib/i18n';
import { ago } from '../lib/format';
import { Modal, Field, Empty, StatusPill } from '../components/ui';

export default function Dispatch() {
  const { t } = usePrefs();
  const [orders, setOrders] = useState([]); const [drivers, setDrivers] = useState([]); const [depots, setDepots] = useState([]);
  const [form, setForm] = useState(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const load = () => Promise.all([api('/dispatch'), api('/users', { params: { role: 'driver' } }), api('/depots')])
    .then(([o, d, p]) => { setOrders(o); setDrivers(d); setDepots(p); }).catch((e) => setErr(t(e.message)));
  useEffect(() => { load(); const i = setInterval(load, 20000); return () => clearInterval(i); }, []); // eslint-disable-line
  const act = (fn) => async () => { setErr(''); try { await fn(); await load(); } catch (x) { setErr(t(x.message)); } };
  const create = async (e) => {
    e.preventDefault(); setErr('');
    try { await api('/dispatch/manual', { method: 'POST', body: { depotId: form.depotId, ...(form.driverId ? { driverId: form.driverId } : {}), ...(form.qty ? { quantity: Number(form.qty) } : {}) } }); setForm(null); load(); } catch (x) { setErr(t(x.message)); }
  };
  const sweep = act(async () => { const r = await api('/dispatch/sweep', { method: 'POST' }); setMsg(t('{n} depots checked.', { n: r.depotsChecked })); });
  const reason = { critical_stock: 'Critical stock', out_of_stock: 'Out of gas', manual: 'Manual' };

  return (
    <>
      <div className="page-head"><div><h1>{t('Dispatch')}</h1><p>{t('Top-up trips created automatically when a depot runs low, sent to the nearest truck.')}</p></div>
        <div className="row"><button className="btn ghost" onClick={sweep}>{t('Check all depots now')}</button><button className="btn" onClick={() => { setErr(''); setForm({ depotId: depots[0] ? depots[0]._id : '', driverId: '', qty: '' }); }}>{t('New order')}</button></div></div>
      {msg && <div className="ok-msg">{msg}</div>}{err && !form && <div className="error">{err}</div>}
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>{t('Depot')}</th><th>{t('Why')}</th><th className="num">{t('Bottles')}</th><th>{t('Truck')}</th><th>{t('Status')}</th><th>{t('Created')}</th><th /></tr></thead>
        <tbody>{orders.map((o) => (
          <tr key={o._id}><td><strong>{o.depotId.shopName}</strong><div className="sub">{o.depotId.neighborhood} · {o.depotId.currentStockCount}/{o.depotId.minimumSafetyStock}</div></td>
            <td>{t(reason[o.reason])}</td><td className="num">{o.suggestedQuantity}</td>
            <td>{o.driverId ? <>{o.driverId.name}{o.distanceKm != null && <div className="sub">{o.distanceKm} km</div>}</> : <span className="sub">{t('unassigned')}</span>}
              <select className="input" style={{ display: 'block', marginTop: 4 }} value="" onChange={(e) => e.target.value && act(() => api(`/dispatch/${o._id}/reassign`, { method: 'POST', body: { driverId: e.target.value } }))()}>
                <option value="">{t('Reassign…')}</option>{drivers.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></td>
            <td><StatusPill status={o.depotId.status} /> <span className="sub">{t(o.status)}</span></td><td className="sub">{ago(o.createdAt, t)}</td>
            <td><button className="btn ghost small" onClick={act(() => api(`/dispatch/${o._id}/cancel`, { method: 'POST' }))}>{t('Cancel')}</button></td></tr>))}</tbody></table>
        {!orders.length && <Empty>{t('No open orders. Every depot is above its safety stock.')}</Empty>}</div></div>
      {form && <Modal title={t('New dispatch order')} onClose={() => setForm(null)}><form onSubmit={create}>
        <div className="form-grid">
          <Field label={t('Depot')}><select value={form.depotId} onChange={(e) => setForm({ ...form, depotId: e.target.value })}>{depots.map((d) => <option key={d._id} value={d._id}>{d.shopName} · {d.neighborhood}</option>)}</select></Field>
          <Field label={t('Truck')}><select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}><option value="">{t('Nearest driver')}</option>{drivers.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label={t('Bottles (optional)')}><input type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></Field></div>
        {err && <div className="error">{err}</div>}<button className="btn">{t('Create order')}</button></form></Modal>}
    </>
  );
}
