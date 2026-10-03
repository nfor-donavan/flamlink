import { usePrefs } from '../lib/i18n';

// Language (EN/FR) and light/dark switches.
export default function Toggles({ onDark }) {
  const { lang, setLang, theme, toggleTheme, t } = usePrefs();
  return (
    <div className={`toggles ${onDark ? 'on-dark' : ''}`}>
      <div className="seg" role="group" aria-label={t('Language')}>
        {['en', 'fr'].map((l) => <button key={l} className={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
      </div>
      <button className="seg-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? t('Switch to light mode') : t('Switch to dark mode')} title={theme === 'dark' ? t('Light mode') : t('Dark mode')}>
        {theme === 'dark'
          ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>}
      </button>
    </div>
  );
}
