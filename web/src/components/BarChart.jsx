import { dayShort, num } from '../lib/format';
import { usePrefs } from '../lib/i18n';

// Delivered vs collected bottles per day. Plain SVG, no chart library.
export default function BarChart({ data }) {
  const { t, lang } = usePrefs();
  const max = Math.max(10, ...data.flatMap((d) => [d.delivered, d.collected]));
  const W = 520, H = 190, pad = 28, bw = 16, gap = (W - pad * 2) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={t('Bottles moved, last 7 days')}>
      {[0, 0.5, 1].map((t) => <line key={t} x1={pad} x2={W - pad} y1={H - 28 - t * (H - 52)} y2={H - 28 - t * (H - 52)} stroke="var(--line)" />)}
      {data.map((d, i) => {
        const x = pad + i * gap + gap / 2;
        const h1 = (d.delivered / max) * (H - 52), h2 = (d.collected / max) * (H - 52);
        return (
          <g key={d.date}>
            <rect x={x - bw - 1} y={H - 28 - h1} width={bw} height={h1} rx="3" fill="var(--flame)"><title>{t('{n} delivered', { n: d.delivered })}</title></rect>
            <rect x={x + 1} y={H - 28 - h2} width={bw} height={h2} rx="3" fill="var(--brass)"><title>{t('{n} collected', { n: d.collected })}</title></rect>
            <text x={x} y={H - 10} textAnchor="middle" className="chart-lbl">{dayShort(d.date, lang)}</text>
            {d.delivered > 0 && <text x={x - bw / 2 - 1} y={H - 32 - h1} textAnchor="middle" className="chart-val">{num(d.delivered)}</text>}
          </g>
        );
      })}
    </svg>
  );
}
