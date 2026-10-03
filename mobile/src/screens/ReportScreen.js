import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { api } from '../lib/api';
import { usePrefs } from '../lib/prefs';
import { Button, Card, Header, Input, Txt } from '../components/ui';

export default function ReportScreen({ onBack }) {
  const { t, colors } = usePrefs();
  const [depots, setDepots] = useState([]); const [q, setQ] = useState(''); const [depot, setDepot] = useState(null);
  const [kind, setKind] = useState('price'); const [price, setPrice] = useState(''); const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { api('/depots').then(setDepots).catch(() => {}); }, []);
  const list = useMemo(() => depots.filter((d) => (d.shopName + d.neighborhood).toLowerCase().includes(q.toLowerCase())), [depots, q]);
  const send = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await api('/prices/reports', { method: 'POST', body: { depotId: depot._id, kind, sizeKg: 12.5, ...(kind === 'price' ? { priceXAF: Number(price) } : {}) } });
      setMsg(r.flagged ? { bad: true, text: t('Flagged: {reason}', { reason: r.reason }) } : { text: kind === 'price' ? t('Thanks, the price is within the legal limit.') : t('Report sent.') });
    } catch (e) { setMsg({ bad: true, text: t(e.message) }); } finally { setBusy(false); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={t('Report a price')} onBack={depot ? () => { setDepot(null); setMsg(null); } : onBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        {!depot ? (
          <>
            <Txt size="l">{t('Choose the depot')}</Txt>
            <Input placeholder={t('Search depots')} value={q} onChangeText={setQ} />
            {list.map((d) => <Pressable key={d._id} onPress={() => setDepot(d)}><Card><Txt weight="800">{d.shopName}</Txt><Txt muted>{d.neighborhood}</Txt></Card></Pressable>)}
          </>
        ) : (
          <>
            <Txt size="l">{depot.shopName}</Txt>
            <Txt muted>{t('What did you see?')}</Txt>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button kind={kind === 'price' ? 'primary' : 'ghost'} title={t('Price charged')} onPress={() => setKind('price')} style={{ flex: 1 }} />
              <Button kind={kind === 'no_stock' ? 'primary' : 'ghost'} title={t('Says it has no gas')} onPress={() => setKind('no_stock')} style={{ flex: 1 }} />
            </View>
            {kind === 'price' && <Input label={t('Price (XAF)')} keyboardType="number-pad" value={price} onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ''))} />}
            {msg && <Card style={{ backgroundColor: msg.bad ? colors.badBg : colors.okBg, borderColor: msg.bad ? colors.bad : colors.ok }}><Txt weight="800" color={msg.bad ? colors.bad : colors.ok}>{msg.text}</Txt></Card>}
            <Button title={t('Send report')} disabled={busy || (kind === 'price' && !price)} onPress={send} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
