import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { api } from '../lib/api';
import { usePrefs } from '../lib/prefs';
import { Button, Card, Header, Pill, Txt } from '../components/ui';
import Scanner from '../components/Scanner';

const LABEL = { At_Plant_Empty: 'Empty at plant', At_Plant_Filled: 'Filled at plant', In_Transit: 'On a truck', At_Retailer_Full: 'Full at depot', At_Retailer_Empty: 'Empty at depot', Scrapped: 'Scrapped' };

export default function LookupScreen({ onBack }) {
  const { t, colors } = usePrefs();
  const [res, setRes] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const scan = (code) => {
    if (busy) return 'wait';
    setBusy(true); setErr('');
    api(`/cylinders/lookup/${encodeURIComponent(code)}`).then(setRes).catch((e) => { setRes(null); setErr(t(e.message)); }).finally(() => setBusy(false));
    return true;
  };
  const c = res && res.cylinder;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={t('Check a bottle')} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {!c && <Scanner active onScan={scan} height={260} />}
        {err ? <Card style={{ backgroundColor: colors.badBg, borderColor: colors.bad }}><Txt weight="800" color={colors.bad}>{err}</Txt></Card> : null}
        {c && (
          <>
            <Card style={{ gap: 8 }}>
              <Txt size="xl">{c.barcodeSerial}</Txt>
              <Txt muted>{c.brand} · {c.sizeKg} kg</Txt>
              <Pill tone={c.isFull ? 'ok' : 'warn'} text={`${t(LABEL[c.currentStatus])}${c.currentStatus === 'In_Transit' ? ` (${c.isFull ? t('Full') : t('Empty')})` : ''}`} />
              <Txt>{t('Held by')}: <Txt weight="800">{(c.currentHolderId && c.currentHolderId.name) || (c.currentDepotId && c.currentDepotId.shopName) || '—'}</Txt></Txt>
            </Card>
            <Txt size="l">{t('History')}</Txt>
            {res.history.slice(0, 8).map((h) => (
              <Card key={h._id} style={{ paddingVertical: 10 }}><Txt weight="700">{t(LABEL[h.toStatus])}</Txt><Txt size="s" muted>{new Date(h.createdAt).toLocaleString()}{h.depotId ? ` · ${h.depotId.shopName}` : ''}</Txt></Card>
            ))}
            <Button title={t('Scan again')} onPress={() => { setRes(null); setErr(''); }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
