import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { usePrefs } from '../lib/i18n';
import { StatusPill, StockGauge, Modal, Field, Empty } from '../components/ui';

const blank = { shopName: '', neighborhood: '', ownerName: '', ownerPhone: '', minimumSafetyStock: 5, lat: '', lng: '' };

export default function Depots() {
  const { t } = usePrefs();
  const [rows, setRows] = useState([]); const [filter, setFilter] = useState('');
  const [form, setForm] = useState(null); const [err, setErr] = useState(''); const [sale, setSale] = useState(null);
  const load = () => api('/depots', { params: { status: filter } }).then(setRows).catch((e) => setErr(t(e.message)));
  useEffect(() => { load(); }, [filter]); // eslint-disable-line

  const save = async (e) => {
    e.preventDefault(); setErr('');
    const { lat, lng, minimumSafetyStock, ...rest } = form;
    try {
      await api('/depots', { method: 'POST', body: { ...rest, minimumSafetyStock: Number(minimumSafetyStock), ...(lat && lng ? { location: { lat: Number(lat), lng: Number(lng) } } : {}) } });
      setForm(null); load();
    } catch (x) { setErr(t(x.message)); }
  };
  const recordSale = async (e) => {
    e.preventDefault(); setErr('');
    try { await api(`/depots/${sale.id}/sales`, { method: 'POST', body: { quantity: Number(sale.qty) } }); setSale(null); load(); } catch (x) { setErr(t(x.message)); }
  };
  const F = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <>
      <div className="page-head"><div><h1>{t('Depots')}</h1><p>{t('Neighbourhood shops you supply.')}</p></div><button className="btn" onClick={() => { setErr(''); setForm(blank); }}>{t('Add depot')}</button></div>
      <div className="tabs">{[['', 'All'], ['OUT,CRITICAL', 'Needs gas'], ['LOW', 'Running low'], ['HEALTHY', 'Healthy']].map(([v, l]) => <button key={v} className={filter === v ? 'on' : ''} onClick={() => setFilter(v)}>{t(l)}</button>)}</div>
      {err && !form && !sale && <div className="error">{err}</div>}
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>{t('Shop')}</th><th>{t('Area')}</th><th>{t('Owner phone')}</th><th>{t('Stock level')}</th><th className="num">{t('Full')}</th><th>{t('Status')}</th><th /></tr></thead>
        <tbody>{rows.map((d) => (
          <tr key={d._id}><td><strong>{d.shopName}</strong></td><td>{d.neighborhood}</td><td>{d.ownerPhone}</td>
            <td><StockGauge stock={d.currentStockCount} min={d.minimumSafetyStock} /></td>
            <td className="num">{d.currentStockCount} <span className="sub">/ {t('min')} {d.minimumSafetyStock}</span></td>
            <td><StatusPill status={d.status} /></td>
            <td><button className="btn ghost small" onClick={() => { setErr(''); setSale({ id: d._id, name: d.shopName, qty: 1 }); }}>{t('Record sale')}</button></td></tr>
        ))}</tbody></table>
        {!rows.length && <Empty>{t('No depots here yet. Add your first depot to start tracking stock.')}</Empty>}
      </div></div>

      {form && (
        <Modal title={t('Add depot')} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label={t('Shop name')}><input required {...F('shopName')} /></Field>
              <Field label={t('Neighbourhood')}><input required placeholder="Bastos" {...F('neighborhood')} /></Field>
              <Field label={t('Owner name')}><input {...F('ownerName')} /></Field>
              <Field label={t('Owner phone')}><input required {...F('ownerPhone')} /></Field>
              <Field label={t('Safety stock (bottles)')}><input type="number" min="0" {...F('minimumSafetyStock')} /></Field>
              <span />
              <Field label={t('Latitude')}><input placeholder="3.8667" {...F('lat')} /></Field>
              <Field label={t('Longitude')}><input placeholder="11.5167" {...F('lng')} /></Field>
            </div>
            {err && <div className="error">{err}</div>}
            <button className="btn">{t('Save depot')}</button>
          </form>
        </Modal>
      )}
      {sale && (
        <Modal title={`${t('Record sale')} · ${sale.name}`} onClose={() => setSale(null)}>
          <form onSubmit={recordSale}>
            <Field label={t('Full bottles sold to households')}><input type="number" min="1" value={sale.qty} onChange={(e) => setSale({ ...sale, qty: e.target.value })} /></Field>
            {err && <div className="error">{err}</div>}
            <p className="sub">{t('Sold bottles become empty shells at the depot, and the sale rate feeds the stock-out forecast.')}</p>
            <button className="btn">{t('Record sale')}</button>
          </form>
        </Modal>
      )}
    </>
  );
}
