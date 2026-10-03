import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { usePrefs } from '../lib/i18n';
import { ago, num, STATUS_LABEL } from '../lib/format';
import { Stat, Modal, Field, Empty } from '../components/ui';
import StockMap from '../components/StockMap';

const STATUSES = ['At_Plant_Empty', 'At_Plant_Filled', 'In_Transit', 'At_Retailer_Full', 'At_Retailer_Empty'];

export default function Assets() {
  const { t } = usePrefs();
  const [emp, setEmp] = useState(null); const [list, setList] = useState({ items: [], total: 0 });
  const [status, setStatus] = useState(''); const [q, setQ] = useState(''); const [detail, setDetail] = useState(null);
  const [reg, setReg] = useState(null); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const loadEmp = () => api('/inventory/empties').then(setEmp).catch((e) => setErr(t(e.message)));
  const loadList = () => api('/cylinders', { params: { status, q, limit: 40 } }).then(setList).catch((e) => setErr(t(e.message)));
  useEffect(() => { loadEmp(); }, []); // eslint-disable-line
  useEffect(() => { loadList(); }, [status, q]); // eslint-disable-line

  const open = async (serial) => setDetail(await api(`/cylinders/lookup/${serial}`));
  const register = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const r = await api('/cylinders/register', { method: 'POST', body: { brand: reg.brand, sizeKg: Number(reg.sizeKg), range: { prefix: reg.prefix, start: Number(reg.start), count: Number(reg.count), pad: 6 } } });
      setMsg(t('{n} cylinders registered.', { n: r.created }) + (r.skippedExisting.length ? ' ' + t('{n} already existed.', { n: r.skippedExisting.length }) : '')); setReg(null); loadList(); loadEmp();
    } catch (x) { setErr(t(x.message)); }
  };
  const R = (k) => ({ value: reg[k], onChange: (e) => setReg({ ...reg, [k]: e.target.value }) });
  const tt = emp && emp.statusTotals;
  const lockedEmpties = emp ? emp.byDepot.reduce((s, r) => s + r.empties, 0) : 0;
  return (
    <>
      <div className="page-head"><div><h1>{t('Cylinders')}</h1><p>{t('Every steel bottle, where it is and who holds it.')}</p></div>
        <button className="btn" onClick={() => { setErr(''); setReg({ brand: 'SCTM', sizeKg: 12.5, prefix: 'SCT-', start: 1, count: 100 }); }}>{t('Register bottles')}</button></div>
      {msg && <div className="ok-msg">{msg}</div>}
      {err && !reg && <div className="error">{err}</div>}
      {tt && <div className="grid g-stats">
        <Stat label={t('At plant (filled)')} value={num(tt.At_Plant_Filled)} tone="good" /><Stat label={t('At plant (empty)')} value={num(tt.At_Plant_Empty)} />
        <Stat label={t('On trucks')} value={num(tt.In_Transit)} tone="flame" /><Stat label={t('Full at depots')} value={num(tt.At_Retailer_Full)} tone="flame" />
        <Stat label={t('Empty shells at depots')} value={num(lockedEmpties)} tone="brass" hint={t('{n} there for over 3 days', { n: num(emp.byDepot.reduce((s, r) => s + r.stale, 0)) })} />
      </div>}

      {emp && <div className="grid g-2">
        <section className="card hero"><div className="hero-head"><h2>{t('Where the empty shells are locked up')}</h2><p className="sub">{t('Bigger dot, more empties. Each one is capital you have to get back.')}</p></div>
          <StockMap mode="empties" depots={emp.byDepot} height={340} /></section>
        <section className="card"><div className="card-head"><h2>{t('Biggest holders')}</h2></div>
          {emp.byDepot.length === 0 && <Empty>{t('No empty shells are sitting at depots.')}</Empty>}
          <div className="table-wrap"><table><tbody>{emp.byDepot.slice(0, 8).map((r) => (
            <tr key={r.depotId}><td><strong>{r.shopName}</strong><div className="sub">{r.neighborhood} · {t('oldest')} {ago(r.oldest, t)}</div></td><td className="num"><strong>{r.empties}</strong></td></tr>))}</tbody></table></div>
          <h3 style={{ margin: '14px 0 6px' }}>{t('On trucks')}</h3>
          <table><tbody>{emp.byDriver.map((r) => <tr key={r.driverId}><td>{r.name}</td><td className="num">{r.full} {t('full')} · {r.empty} {t('empty')}</td></tr>)}</tbody></table>
        </section>
      </div>}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>{t('Asset register')} <span className="sub">({num(list.total)})</span></h2>
          <div className="row"><input className="input" placeholder={t('Search serial, e.g. SCT-0001')} value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{t('All statuses')}</option>{STATUSES.map((s) => <option key={s} value={s}>{t(STATUS_LABEL[s])}</option>)}</select></div></div>
        <div className="table-wrap"><table>
          <thead><tr><th>{t('Serial')}</th><th>{t('Brand')}</th><th>{t('Size')}</th><th>{t('Status')}</th><th>{t('Held by')}</th><th>{t('Moved')}</th></tr></thead>
          <tbody>{list.items.map((c) => (
            <tr key={c._id}><td><button className="btn ghost small" onClick={() => open(c.barcodeSerial)}>{c.barcodeSerial}</button></td><td>{c.brand}</td><td>{c.sizeKg} kg</td>
              <td>{t(STATUS_LABEL[c.currentStatus])}{c.currentStatus === 'In_Transit' ? (c.isFull ? ` (${t('full')})` : ` (${t('empty')})`) : ''}</td>
              <td>{(c.currentHolderId && c.currentHolderId.name) || (c.currentDepotId && c.currentDepotId.shopName) || t('Plant')}</td><td className="sub">{ago(c.lastMovedAt, t)}</td></tr>))}</tbody></table>
          {!list.items.length && <Empty>{t('No cylinders match. Register bottles to start the register.')}</Empty>}</div>
      </section>

      {reg && <Modal title={t('Register bottles')} onClose={() => setReg(null)}>
        <form onSubmit={register}><div className="form-grid">
          <Field label={t('Brand')}><select {...R('brand')}>{['SCTM', 'Tradex', 'Total', 'Afrigaz', 'Camgaz'].map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label={t('Size')}><select {...R('sizeKg')}>{[6, 12.5, 28, 50].map((s) => <option key={s} value={s}>{s} kg</option>)}</select></Field>
          <Field label={t('Serial prefix')}><input {...R('prefix')} /></Field>
          <Field label={t('First number')}><input type="number" {...R('start')} /></Field>
          <Field label={t('How many')}><input type="number" min="1" max="5000" {...R('count')} /></Field></div>
          <p className="sub">{t('Example: prefix SCT-, first 1, count 100 creates SCT-000001 to SCT-000100.')}</p>
          {err && <div className="error">{err}</div>}<button className="btn">{t('Register')}</button></form></Modal>}
      {detail && <Modal title={detail.cylinder.barcodeSerial} onClose={() => setDetail(null)}>
        <p>{detail.cylinder.brand} · {detail.cylinder.sizeKg} kg · {t(STATUS_LABEL[detail.cylinder.currentStatus])}</p>
        <h3>{t('History')}</h3><table><tbody>{detail.history.map((h) => <tr key={h._id}><td>{t(h.action)}</td><td>{t(STATUS_LABEL[h.toStatus])}</td><td className="sub">{(h.depotId && h.depotId.shopName) || (h.actorId && h.actorId.name) || ''}</td><td className="sub">{ago(h.createdAt, t)}</td></tr>)}</tbody></table></Modal>}
    </>
  );
}
