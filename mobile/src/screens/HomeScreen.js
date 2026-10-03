import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { api, ApiError } from '../lib/api';
import { flush, pendingCount } from '../lib/queue';
import { usePrefs } from '../lib/prefs';
import { Button, Card, Header, Pill, Toggles, Txt } from '../components/ui';

export default function HomeScreen({ user, go, onLogout }) {
  const { t, colors } = usePrefs();
  const [orders, setOrders] = useState([]); const [recent, setRecent] = useState([]);
  const [pending, setPending] = useState(0); const [offline, setOffline] = useState(false); const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      await flush();
      const [o, r] = await Promise.all([api('/dispatch/mine').catch((e) => { if (e.status === 403) return []; throw e; }), api('/handovers', {}).catch((e) => { throw e; })]);
      setOrders(o); setRecent(r.slice(0, 5)); setOffline(false);
    } catch (e) { if (e instanceof ApiError && e.status === 0) setOffline(true); }
    setPending(await pendingCount()); setBusy(false);
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  const accept = async (id) => { try { await api(`/dispatch/${id}/accept`, { method: 'POST' }); load(); } catch { /* ignore */ } };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={t('Hello, {name}', { name: user.name.split(' ')[0] })} right={<Button kind="ghost" title={t('Sign out')} onPress={onLogout} style={{ minHeight: 40, paddingHorizontal: 10, borderColor: '#ffffff66' }} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={colors.flame} />}>
        {offline && <Card style={{ backgroundColor: colors.badBg, borderColor: colors.bad }}><Txt weight="800" color={colors.bad}>{t('Offline')}: {t('Could not reach the server.')}</Txt></Card>}
        {pending > 0 && (
          <Card style={{ borderColor: colors.warn }}>
            <Txt weight="800">{pending === 1 ? t('{n} handover waiting to sync', { n: pending }) : t('{n} handovers waiting to sync', { n: pending })}</Txt>
            <Button kind="ghost" title={t('Sync now')} onPress={load} style={{ marginTop: 10 }} />
          </Card>
        )}
        <Button title={t('Start handover')} onPress={() => go('handover')} style={{ minHeight: 76 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button kind="ghost" title={t('Check a bottle')} onPress={() => go('lookup')} style={{ flex: 1 }} />
          <Button kind="ghost" title={t('Report a price')} onPress={() => go('report')} style={{ flex: 1 }} />
        </View>

        <Txt size="l">{t('Depots to top up')}</Txt>
        {orders.length === 0 && <Card><Txt muted>{t('Nothing urgent. Drive safe.')}</Txt></Card>}
        {orders.map((o) => (
          <Card key={o._id} style={{ borderColor: o.depotId.status === 'OUT' ? colors.bad : colors.warn, borderWidth: 2, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Txt weight="800" style={{ flex: 1 }}>{o.depotId.shopName}</Txt>
              <Pill tone={o.depotId.status === 'OUT' ? 'bad' : 'warn'} text={`${o.depotId.currentStockCount}/${o.depotId.minimumSafetyStock}`} />
            </View>
            <Txt muted>{o.depotId.neighborhood}{o.distanceKm != null ? ` · ${t('{n} km', { n: o.distanceKm })}` : ''}</Txt>
            <Txt weight="700">{t('Bring {n} full bottles', { n: o.suggestedQuantity })}</Txt>
            {o.status === 'pending' ? <Button title={t('Accept')} onPress={() => accept(o._id)} /> : <Pill text={t('Accepted')} />}
          </Card>
        ))}

        <Txt size="l">{t('Recent handovers')}</Txt>
        {recent.length === 0 && <Card><Txt muted>{t('No handovers yet.')}</Txt></Card>}
        {recent.map((h) => (
          <Card key={h._id} style={{ gap: 4 }}>
            <Txt weight="800">{h.depotId && h.depotId.shopName}</Txt>
            <Txt muted>{h.cylindersDelivered.length} {t('Full').toLowerCase()} · {h.cylindersCollected.length} {t('Empty').toLowerCase()} · {Math.round(h.cashCollectedXAF).toLocaleString('fr-FR')} XAF</Txt>
            {!h.balanced && <Pill tone="bad" text={`-${h.deficitCount}`} />}
          </Card>
        ))}
        <Toggles />
      </ScrollView>
    </View>
  );
}
