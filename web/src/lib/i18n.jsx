import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import fr from './fr';

const Ctx = createContext(null);
const read = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };

// Strings are keyed by their English text, so a missing French entry safely falls back to English.
export function PrefsProvider({ children }) {
  const [lang, setLang] = useState(() => read('flamlink.lang', (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en'));
  const [theme, setTheme] = useState(() => read('flamlink.theme', window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  useEffect(() => { document.documentElement.lang = lang; localStorage.setItem('flamlink.lang', lang); }, [lang]);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('flamlink.theme', theme); }, [theme]);
  const value = useMemo(() => ({
    lang, theme, setLang, setTheme,
    toggleTheme: () => setTheme((x) => (x === 'dark' ? 'light' : 'dark')),
    t: (s, vars) => {
      const base = lang === 'fr' ? (fr[s] ?? s) : s;
      return vars ? base.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '')) : base;
    },
  }), [lang, theme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const usePrefs = () => useContext(Ctx);
