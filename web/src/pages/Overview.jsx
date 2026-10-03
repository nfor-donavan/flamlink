import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { usePrefs } from '../lib/i18n';
import { num, xaf, STATUS_COLOR, STATUS_LABEL } from '../lib/format';
import { Stat, StatusPill, Empty } from '../components/ui';
import StockMap from '../components/StockMap';
import BarChart from '../components/BarChart';

export default function Overview() {
  const { t } = usePrefs();
  const [ov, setOv] = useState(null); const [zones, setZones] = useState(null); const [err, setErr] = useState('');
  const load = () => Promise.all([api('/dashboard/overview'), api('/inventory/critical-zones', { params: { all: true } })])
    .then(([a, b]) => { setOv(a); setZones(b); }).catch((e) => setErr(t(e.message)));
  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, []); // eslint-disable-line
  if (err) return <div className="error">{err}</div>;
  if (!ov || !zones) return <p>{t('Loading…')}</p>;

  const total = Object.values(ov.depots).reduce((a, b) => a + b, 0) || 1;
  const order = ['HEALTHY', 'LOW', 'CRITICAL', 'OUT'];
  return (
    <>
      <div className="page-head"><div><h1>{t('Distributor matrix')}</h1><p>{t('Stock health across every depot, refreshed every 30 seconds.')}</p></div></div>

      <div className="grid g-stats">
        <Stat label={t('Depots needing gas now')} value={(ov.depots.CRITICAL || 0) + (ov.depots.OUT || 0)} tone={(ov.depots.CRITICAL || ov.depots.OUT) ? 'bad' : 'good'} hint={t('{n} trucks already sent', { n: ov.openDispatchOrders })} />
        <Stat label={t('Full bottles on shelves')} value={num(ov.fullBottlesOnShelves)} tone="flame" hint={t('{n} active depots', { n: total })} />
        <Stat label={t('Delivered today')} value={num(ov.today.delivered)} tone="flame" hint={t('{n} empties collected', { n: num(ov.today.collected) })} />
        <Stat label={t('Cash collected today')} value={xaf(ov.today.cashXAF)} tone="brass" hint={t('{n} handovers', { n: ov.today.handovers })} />
        <Stat label={t('Missing metal shells today')} value={ov.today.deficitBottles} tone={ov.today.deficitBottles ? 'bad' : 'good'} hint={t('{amount} owed by retailers', { amount: xaf(ov.outstandingXAF) })} />
        <Stat label={t('Overpricing reports (7 days)')} value={ov.priceViolations7d} tone={ov.priceViolations7d ? 'bad' : 'good'} />
      </div>

      <div className="grid g-2">
        <section className="card hero">
          <div className="hero-head">
            <h2>{t('Depots by stock health')}</h2>
            <div className="matrix" role="img" aria-label={t('Share of depots by health')}>
              {order.map((k) => <span key={k} style={{ width: `${((ov.depots[k] || 0) / total) * 100}%`, background: STATUS_COLOR[k] }} />)}
            </div>
            <div className="legend">{order.map((k) => <span key={k}><i style={{ '--c': STATUS_COLOR[k] }} />{t(STATUS_LABEL[k])} {ov.depots[k] || 0}</span>)}</div>
          </div>
          <StockMap depots={zones.depots || []} height={430} />
        </section>

        <section className="card">
          <div className="card-head"><h2>{t('Act now')}</h2><span className="sub">{t('{n} flagged', { n: zones.totals.flagged })}</span></div>
          {zones.flagged.length === 0 && <Empty>{t('No depot is close to running out.')}</Empty>}
          {zones.flagged.slice(0, 8).map((d) => (
            <div key={d.depotId} className={`alert-row ${d.riskLevel === 'OUT' || d.riskLevel === 'CRITICAL' ? 'pulse' : ''}`}>
              <div className="grow">
                <strong>{d.shopName}</strong>
                <span className="sub">{d.neighborhood} · {t('{n} left (safety {min})', { n: d.currentStockCount, min: d.minimumSafetyStock })}{d.daysOfCover != null ? ` · ${t('~{n} days of cover', { n: d.daysOfCover })}` : ''}</span>
                <div className="sub">{d.dispatch ? t('Truck: {driver}, bring {n}', { driver: d.dispatch.driver || t('unassigned'), n: d.dispatch.suggestedQuantity }) + (d.dispatch.distanceKm != null ? ` (${d.dispatch.distanceKm} km)` : '') : t('No truck assigned yet')}</div>
              </div>
              <StatusPill status={d.riskLevel} />
            </div>
          ))}
        </section>
      </div>

      <div className="grid g-2" style={{ marginTop: 16 }}>
        <section className="card">
          <div className="card-head"><h2>{t('Bottles moved, last 7 days')}</h2>
            <div className="chart-legend"><span><i style={{ background: 'var(--flame)' }} />{t('Full delivered')}</span><span><i style={{ background: 'var(--brass)' }} />{t('Empties collected')}</span></div></div>
          <BarChart data={ov.week} />
        </section>
        <section className="card">
          <div className="card-head"><h2>{t('Neighbourhoods')}</h2></div>
          <div className="table-wrap"><table>
            <thead><tr><th>{t('Area')}</th><th className="num">{t('Depots')}</th><th className="num">{t('Stock')}</th><th className="num">{t('Short')}</th></tr></thead>
            <tbody>{zones.neighborhoods.map((n) => (
              <tr key={n.neighborhood}><td>{n.neighborhood}</td><td className="num">{n.depots}</td><td className="num">{n.stock}</td>
                <td className="num" style={{ color: n.OUT + n.CRITICAL ? 'var(--crit)' : undefined, fontWeight: 600 }}>{n.OUT + n.CRITICAL + n.AT_RISK || '–'}</td></tr>
            ))}</tbody></table></div>
        </section>
      </div>
    </>
  );
}
