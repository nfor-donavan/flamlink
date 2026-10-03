import { STATUS_LABEL, STATUS_COLOR } from '../lib/format';
import { usePrefs } from '../lib/i18n';

export const StatusPill = ({ status }) => {
  const { t } = usePrefs();
  return <span className="pill" style={{ '--c': STATUS_COLOR[status] || '#6B7F8C' }}>{t(STATUS_LABEL[status] || status)}</span>;
};

// Stock as a fill level against the safety line, like the level in a cylinder.
export const StockGauge = ({ stock, min }) => {
  const { t } = usePrefs();
  const cap = Math.max(min * 3, stock, 1);
  return (
    <div className="gauge" title={t('{stock} in stock, safety level {min}', { stock, min })}>
      <div className="gauge-fill" style={{ width: `${Math.min(100, (stock / cap) * 100)}%` }} />
      <div className="gauge-line" style={{ left: `${(min / cap) * 100}%` }} />
    </div>
  );
};

export const Stat = ({ label, value, hint, tone }) => (
  <div className={`stat ${tone || ''}`}>
    <div className="stat-value">{value}</div>
    <div className="stat-label">{label}</div>
    {hint && <div className="stat-hint">{hint}</div>}
  </div>
);

export const Empty = ({ children }) => <div className="empty">{children}</div>;

export function Modal({ title, onClose, children }) {
  const { t } = usePrefs();
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><button className="btn ghost" onClick={onClose}>{t('Close')}</button></div>
        {children}
      </div>
    </div>
  );
}

export const Field = ({ label, children }) => <label className="field"><span>{label}</span>{children}</label>;
