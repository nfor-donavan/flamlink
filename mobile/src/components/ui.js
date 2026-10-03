import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Image } from 'react-native';
import { usePrefs } from '../lib/prefs';

export function Button({ title, onPress, kind = 'primary', disabled, style }) {
  const { colors } = usePrefs();
  const bg = kind === 'primary' ? colors.flame : kind === 'danger' ? colors.bad : 'transparent';
  const fg = kind === 'primary' ? colors.flameText : kind === 'danger' ? '#fff' : colors.text;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, borderColor: kind === 'ghost' ? colors.line : bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, style]}>
      <Text style={[s.btnText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style }) {
  const { colors } = usePrefs();
  return <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.line }, style]}>{children}</View>;
}

export function Txt({ children, size = 'm', weight, muted, color, style, ...rest }) {
  const { colors } = usePrefs();
  const fs = { s: 14, m: 17, l: 22, xl: 30 }[size];
  return <Text {...rest} style={[{ color: color || (muted ? colors.muted : colors.text), fontSize: fs, fontWeight: weight || (size === 'xl' || size === 'l' ? '800' : '500') }, style]}>{children}</Text>;
}

export function Input({ label, ...props }) {
  const { colors } = usePrefs();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Txt size="s" muted weight="600">{label}</Txt> : null}
      <TextInput placeholderTextColor={colors.muted} {...props} style={[s.input, { backgroundColor: colors.input, borderColor: colors.line, color: colors.text }]} />
    </View>
  );
}

export function Pill({ text, tone = 'ok' }) {
  const { colors } = usePrefs();
  const fg = colors[tone] || colors.ok;
  return <View style={[s.pill, { backgroundColor: fg + '26' }]}><Text style={{ color: fg, fontWeight: '800', fontSize: 13 }}>{text}</Text></View>;
}

export function Header({ title, onBack, right }) {
  const { colors, t } = usePrefs();
  return (
    <View style={[s.header, { backgroundColor: colors.header }]}>
      {onBack ? <Pressable onPress={onBack} accessibilityRole="button" style={s.back}><Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>‹ {t('Back')}</Text></Pressable> : <Brand />}
      <Text numberOfLines={1} style={s.headerTitle}>{title}</Text>
      <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function Brand({ size = 34 }) {
  return <Image source={require('../../assets/icon.png')} style={{ width: size, height: size, borderRadius: size * 0.22 }} />;
}

// Language + theme switches (EN/FR, light/dark).
export function Toggles({ onDark }) {
  const { lang, setLang, theme, setTheme, colors, t } = usePrefs();
  const fg = onDark ? '#fff' : colors.text;
  const Seg = ({ label, on, press }) => (
    <Pressable onPress={press} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={[s.seg, { backgroundColor: on ? colors.flame : 'transparent' }]}><Text style={{ color: on ? colors.flameText : fg, fontWeight: '800' }}>{label}</Text></Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
      <View style={[s.segWrap, { borderColor: onDark ? '#ffffff55' : colors.line }]} accessibilityLabel={t('Language')}>
        <Seg label="EN" on={lang === 'en'} press={() => setLang('en')} /><Seg label="FR" on={lang === 'fr'} press={() => setLang('fr')} />
      </View>
      <View style={[s.segWrap, { borderColor: onDark ? '#ffffff55' : colors.line }]}>
        <Seg label={'☀ ' + t('Light')} on={theme === 'light'} press={() => setTheme('light')} /><Seg label={'☾ ' + t('Dark')} on={theme === 'dark'} press={() => setTheme('dark')} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 58, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnText: { fontSize: 18, fontWeight: '800' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  input: { minHeight: 54, borderRadius: 12, borderWidth: 2, paddingHorizontal: 14, fontSize: 18 },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 44, paddingBottom: 12 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '800' },
  back: { minHeight: 40, justifyContent: 'center' },
  segWrap: { flexDirection: 'row', borderWidth: 1.5, borderRadius: 12, overflow: 'hidden' },
  seg: { paddingHorizontal: 12, paddingVertical: 8 },
});
