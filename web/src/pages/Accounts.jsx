import { useEffect, useState } from 'react';
import { api, session } from '../lib/api';
import { usePrefs } from '../lib/i18n';
import { ago, xaf } from '../lib/format';
import { Modal, Field, Empty, Stat } from '../components/ui';

const SIZES = [['kg6', '6 kg'], ['kg12_5', '12.5 kg'], ['kg28', '28 kg'], ['kg50', '50 kg']];

export default function Accounts() {
  const { t } = usePrefs();
  const [tab, setTab] = useState('balances'); const [bal, setBal] = useState(null); const [vio, setVio] = useState([]);
  const [price, setPrice] = useState(null); const [pay, setPay] = useState(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const isOwner = session.get().user.role === 'owner';
  const load = () => Promise.all([api('/ledger/balances'), api('/prices/violations'), api('/prices/pricing')]).then(([b, v, p]) => { setBal(b); setVio(v); setPrice(p); }).catch((e) => setErr(t(e.message)));
  useEffect(() => { load(); }, []); // eslint-disable-line

  const savePay = async (e) => { e.preventDefault(); setErr(''); try { await api(`/ledger/${pay.id}/payment`, { method: 'POST', body: { amountXAF: Number(pay.amount), note: pay.note } }); setPay(null); load(); } catch (x) { setErr(t(x.message)); } };
  const savePrice = async () => { setErr(''); try { await api('/prices/pricing', { method: 'PUT', body: Object.fromEntries(SIZES.map(([k]) => [k, Object.fromEntries(Object.entries(price[k]).filter(([f]) => ['depositXAF', 'wholesaleXAF', 'maxRetailXAF'].includes(f)).map(([f, v]) => [f, Number(v)]))])) }); setMsg(t('Prices saved.')); } catch (x) { setErr(t(x.message)); } };
  const setP = (k, f, v) => setPrice({ ...price, [k]: { ...price[k], [f]: v } });

  return (
    <>
      <div className="page-head"><div><h1>{t('Accounts & prices')}</h1><p>{t('What retailers owe, who overcharges, and your price table.')}</p></div></div>
      <div className="tabs">{[['balances', 'Retailer balances'], ['violations', 'Overpricing & hoarding'], ['pricing', 'Price table']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t(l)}</button>)}</div>
      {msg && <div className="ok-msg">{msg}</div>}{err && !pay && <div className="error">{err}</div>}

      {tab === 'balances' && bal && <>
        <div className="grid g-stats"><Stat label={t('Total owed by retailers')} value={xaf(bal.totalOutstandingXAF)} tone={bal.totalOutstandingXAF ? 'bad' : 'good'} /></div>
        <div className="card"><div className="table-wrap"><table>
          <thead><tr><th>{t('Depot')}</th><th>{t('Owner phone')}</th><th className="num">{t('Balance')}</th><th>{t('Last entry')}</th><th /></tr></thead>
          <tbody>{bal.rows.map((r) => (<tr key={r.depotId}><td><strong>{r.shopName}</strong><div className="sub">{r.neighborhood}</div></td><td>{r.ownerPhone}</td>
            <td className="num" style={{ fontWeight: 700, color: r.balanceXAF > 0 ? 'var(--crit)' : 'var(--ok)' }}>{xaf(r.balanceXAF)}</td><td className="sub">{ago(r.lastAt, t)}</td>
            <td><button className="btn ghost small" disabled={r.balanceXAF <= 0} onClick={() => { setErr(''); setPay({ id: r.depotId, name: r.shopName, amount: r.balanceXAF, note: '' }); }}>{t('Record payment')}</button></td></tr>))}</tbody></table>
          {!bal.rows.length && <Empty>{t('No charges yet. Missing shells and cash shortfalls will appear here.')}</Empty>}</div></div></>}

      {tab === 'violations' && <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>{t('Depot')}</th><th>{t('Owner phone')}</th><th className="num">{t('Reports')}</th><th className="num">{t('Highest price')}</th><th className="num">{t('"No stock" claims')}</th><th>{t('Last report')}</th></tr></thead>
        <tbody>{vio.map((r) => (<tr key={r.depotId}><td><strong>{r.shopName}</strong><div className="sub">{r.neighborhood}</div></td><td>{r.ownerPhone}</td><td className="num">{r.reports}</td>
          <td className="num" style={{ color: 'var(--crit)', fontWeight: 700 }}>{r.maxPriceXAF ? xaf(r.maxPriceXAF) : '–'}</td><td className="num">{r.noStockClaims}</td><td className="sub">{ago(r.lastAt, t)}</td></tr>))}</tbody></table>
        {!vio.length && <Empty>{t('No overpricing or hoarding reports in the last 14 days.')}</Empty>}</div></div>}

      {tab === 'pricing' && price && <div className="card">
        <p className="sub">{t('The retail ceiling is what a depot may legally charge. The deposit is billed for each missing metal shell.')}</p>
        <div className="table-wrap"><table><thead><tr><th>{t('Size')}</th><th>{t('Wholesale gas price')}</th><th>{t('Max retail price')}</th><th>{t('Shell deposit')}</th></tr></thead>
          <tbody>{SIZES.map(([k, label]) => (<tr key={k}><td><strong>{label}</strong></td>
            {['wholesaleXAF', 'maxRetailXAF', 'depositXAF'].map((f) => <td key={f}><input className="input" type="number" min="0" disabled={!isOwner} value={price[k][f]} onChange={(e) => setP(k, f, e.target.value)} style={{ width: 130 }} /></td>)}</tr>))}</tbody></table></div>
        {isOwner ? <button className="btn" style={{ marginTop: 14 }} onClick={savePrice}>{t('Save prices')}</button> : <p className="sub">{t('Only the owner can change prices.')}</p>}</div>}

      {pay && <Modal title={`${t('Record payment')} · ${pay.name}`} onClose={() => setPay(null)}><form onSubmit={savePay}>
        <div className="form-grid"><Field label={t('Amount (XAF)')}><input type="number" min="1" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
          <Field label={t('Note')}><input value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></Field></div>
        {err && <div className="error">{err}</div>}<button className="btn">{t('Save payment')}</button></form></Modal>}
    </>
  );
}
