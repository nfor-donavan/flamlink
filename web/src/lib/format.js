export const xaf = (n) => `${Math.round(n || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} XAF`;
export const num = (n) => (n || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
export const ago = (d, t) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(d)) / 1000));
  if (s < 3600) return t('{n} min ago', { n: Math.max(1, Math.round(s / 60)) });
  if (s < 86400) return t('{n} h ago', { n: Math.round(s / 3600) });
  return t('{n} d ago', { n: Math.round(s / 86400) });
};
export const dayShort = (iso, lang) => new Date(iso + 'T12:00:00').toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short' });
// English labels; translate with t(STATUS_LABEL[key]).
export const STATUS_LABEL = {
  HEALTHY: 'Healthy', LOW: 'Running low', CRITICAL: 'Critical', OUT: 'Out of gas', AT_RISK: 'Will run short',
  At_Plant_Empty: 'Empty at plant', At_Plant_Filled: 'Filled at plant', In_Transit: 'On a truck',
  At_Retailer_Full: 'Full at depot', At_Retailer_Empty: 'Empty at depot', Scrapped: 'Scrapped',
};
export const STATUS_COLOR = { HEALTHY: '#1E9E6A', LOW: '#E3A21A', AT_RISK: '#E3A21A', CRITICAL: '#E4572E', OUT: '#B3123A' };
