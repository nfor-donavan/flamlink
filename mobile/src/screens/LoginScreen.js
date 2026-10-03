import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { api, session } from '../lib/api';
import { usePrefs } from '../lib/prefs';
import { Button, Input, Txt, Brand, Toggles } from '../components/ui';

export default function LoginScreen({ onLoggedIn }) {
  const { t, colors } = usePrefs();
  const [f, setF] = useState({ identifier: '', password: '', tenantSlug: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const data = await api('/auth/login', { method: 'POST', body: { ...f, tenantSlug: f.tenantSlug || undefined } });
      if (!['driver', 'manager', 'owner'].includes(data.user.role)) throw new Error(t('Drivers only: please use the dashboard for management tasks.'));
      await session.set(data); onLoggedIn(data);
    } catch (e) { setErr(t(e.message)); } finally { setBusy(false); }
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.header }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 70, gap: 22, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Toggles onDark />
        <View style={{ alignItems: 'center', gap: 12, marginTop: 10 }}>
          <Brand size={96} />
          <Txt size="xl" color="#fff">Flamlink</Txt>
          <Txt color="#9fc3d6" style={{ textAlign: 'center' }}>{t('Every cylinder. Every depot.')}</Txt>
        </View>
        <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 18, gap: 14 }}>
          <Input label={t('Email or phone')} autoCapitalize="none" keyboardType="email-address" value={f.identifier} onChangeText={(v) => setF({ ...f, identifier: v })} />
          <Input label={t('Password')} secureTextEntry value={f.password} onChangeText={(v) => setF({ ...f, password: v })} />
          <Input label={t('Company code (only if asked)')} autoCapitalize="none" placeholder="gaz-capitale" value={f.tenantSlug} onChangeText={(v) => setF({ ...f, tenantSlug: v })} />
          {err ? <Txt color={colors.bad} weight="700">{err}</Txt> : null}
          <Button title={busy ? t('Signing in…') : t('Sign in')} onPress={submit} disabled={busy || !f.identifier || !f.password} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
