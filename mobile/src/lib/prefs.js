import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import fr from './fr';
import { palettes } from '../theme';

const Ctx = createContext(null);

// English text is the key; French falls back to English when a string is missing.
export function PrefsProvider({ children }) {
  const system = useColorScheme();
  const [lang, setLang] = useState(() => (((Intl.DateTimeFormat().resolvedOptions().locale) || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en'));
  const [mode, setMode] = useState(null); // 'light' | 'dark' | null = follow system
  const [ready, setReady] = useState(false);
  useEffect(() => {
    AsyncStorage.multiGet(['flamlink.lang', 'flamlink.mode']).then(([[, l], [, m]]) => { if (l) setLang(l); if (m) setMode(m); }).finally(() => setReady(true));
  }, []);
  const value = useMemo(() => {
    const theme = mode || system || 'light';
    return {
      ready, lang, theme, colors: palettes[theme],
      setLang: (l) => { setLang(l); AsyncStorage.setItem('flamlink.lang', l); },
      setTheme: (m) => { setMode(m); AsyncStorage.setItem('flamlink.mode', m); },
      t: (s, vars) => {
        const base = lang === 'fr' ? (fr[s] ?? s) : s;
        return vars ? base.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : base;
      },
    };
  }, [lang, mode, system, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const usePrefs = () => useContext(Ctx);
