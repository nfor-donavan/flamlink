import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { api, uid } from '../lib/api';
import { submitHandover } from '../lib/queue';
import { usePrefs } from '../lib/prefs';
import { Button, Card, Header, Input, Pill, Txt } from '../components/ui';
import Scanner from '../components/Scanner';

const METHODS = [['Cash', 'Cash'], ['MoMo', 'MTN MoMo'], ['Orange_Money', 'Orange Money']];

export default function HandoverScreen({ onBack }) {
  useKeepAwake();
  const { t, colors } = usePrefs();
  const [step, setStep] = useState('depot'); // depot | full | empty | review | done
  const [depots, setDepots] = useState([]); const [orders, setOrders] = useState([]); const [q, setQ] = useState('');
  const [depot, setDepot] = useState(null);
  const [full, setFull] = useState([]); const [empty, setEmpty] = useState([]);
  const [paused, setPaused] = useState(false); const [manual, setManual] = useState('');
  const [cash, setCash] = useState(''); const [method, setMethod] = useState('Cash');
  const [key, setKey] = useState(uid); const [sending, setSending] = useState(false); const [result, setResult] = useState(null);

  useEffect(() => {
    api('/depots').then(setDepots).catch(() => {});
    api('/dispatch/mine').then(setOrders).catch(() => {});
  }, []);
  const urgent = useMemo(() => new Set(orders.map((o) => String(o.depotId._id))), [orders]);
  const list = useMemo(() => depots
    .filter((d) => (d.shopName + d.neighborhood).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (urgent.has(b._id) - urgent.has(a._id)) || a.shopName.localeCompare(b.shopName)), [depots, q, urgent]);

  const mine = step === 'full' ? full : empty;
  const other = step === 'full' ? empty : full;
  const setMine = step === 'full' ? setFull : setEmpty;
  const add = (code) => {
    if (mine.includes(code)) return t('Already scanned');
    if (other.includes(code)) return t('Already in the other list');
    setMine((l) => [code, ...l]);
    return true;
  };
  const addManual = () => { const c = manual.trim().toUpperCase(); if (c && add(c) === true) setManual(''); };

  const diff = full.length - empty.length;
  const send = async () => {
    if (!full.length && !empty.length) return;
    setSending(true);
    const r = await submitHandover({
      idempotencyKey: key, depotId: depot._id, cylindersDelivered: full, cylindersCollected: empty,
      cashCollectedXAF: Number(cash || 0), paymentMethod: method, clientCreatedAt: new Date().toISOString(),
    });
    setSending(false); setResult(r); setStep('done');
  };
  const fixRejected = () => {
    const bad = new Set((Array.isArray(result.details) ? result.details : []).map((p) => p.serial));
    setFull((l) => l.filter((x) => !bad.has(x))); setEmpty((l) => l.filter((x) => !bad.has(x)));
    setKey(uid()); setResult(null); setStep('full');
  };

  const stepNo = { depot: 1, full: 2, empty: 3, review: 4, done: 4 }[step];
  const Chip = ({ code, onRemove }) => (
    <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}>
      <Txt weight="800" style={{ letterSpacing: 0.5 }}>{code}</Txt>
      <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={t('Remove')} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}><Txt color={colors.bad} weight="800">✕</Txt></Pressable>
    </Card>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={depot ? depot.shopName : t('Start handover')} onBack={step === 'done' ? undefined : (step === 'depot' ? onBack : () => setStep({ full: 'depot', empty: 'full', review: 'empty' }[step]))} />
      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}><Txt size="s" muted weight="700">{t('Step {a} of {b}', { a: stepNo, b: 4 })}</Txt></View>

      {step === 'depot' && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
          <Txt size="l">{t('Choose the depot')}</Txt>
          <Input placeholder={t('Search depots')} value={q} onChangeText={setQ} />
          {list.map((d) => (
            <Pressable key={d._id} onPress={() => { setDepot(d); setStep('full'); }} accessibilityRole="button">
              <Card style={{ borderColor: urgent.has(d._id) ? colors.warn : colors.line, borderWidth: urgent.has(d._id) ? 2 : 1, gap: 4 }}>
                <Txt weight="800">{d.shopName}</Txt><Txt muted>{d.neighborhood} · {d.currentStockCount}/{d.minimumSafetyStock}</Txt>
                {urgent.has(d._id) && <Pill tone="warn" text={t('Needs gas')} />}
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {(step === 'full' || step === 'empty') && (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
            <Txt size="l">{step === 'full' ? t('Scan full bottles you are dropping off') : t('Scan empties you are taking back')}</Txt>
            <Scanner active={!paused} onScan={add} height={230} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button kind="ghost" title={paused ? t('Resume') : t('Pause')} onPress={() => setPaused(!paused)} style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}><Input placeholder={t('Type a serial')} autoCapitalize="characters" value={manual} onChangeText={setManual} onSubmitEditing={addManual} /></View>
              <Button title={t('Add')} onPress={addManual} style={{ minHeight: 54 }} />
            </View>
            <Txt size="l" color={colors.flame}>{t('Scanned: {n}', { n: mine.length })}</Txt>
            {mine.map((c) => <Chip key={c} code={c} onRemove={() => setMine((l) => l.filter((x) => x !== c))} />)}
          </ScrollView>
          <View style={{ padding: 16, backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.line }}>
            <Button title={step === 'full' ? `${t('Next')}  ·  ${t('Empties collected')}` : `${t('Next')}  ·  ${t('Review')}`} onPress={() => { setPaused(false); setStep(step === 'full' ? 'empty' : 'review'); }} />
          </View>
        </View>
      )}

      {step === 'review' && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Txt size="l">{t('Review and send')}</Txt>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Card style={{ flex: 1, alignItems: 'center' }}><Txt size="xl" color={colors.flame}>{full.length}</Txt><Txt muted>{t('Full bottles')}</Txt></Card>
            <Card style={{ flex: 1, alignItems: 'center' }}><Txt size="xl" color={colors.flame}>{empty.length}</Txt><Txt muted>{t('Empties')}</Txt></Card>
          </View>
          {diff > 0 ? <Card style={{ backgroundColor: colors.badBg, borderColor: colors.bad }}><Txt weight="800" color={colors.bad}>{t('{n} empties missing: a deposit charge will be billed to the shop', { n: diff })}</Txt></Card>
            : diff < 0 ? <Card style={{ borderColor: colors.warn }}><Txt weight="800">{t('More empties than full: extra credit may apply')}</Txt></Card>
            : <Card style={{ backgroundColor: colors.okBg, borderColor: colors.ok }}><Txt weight="800" color={colors.ok}>✓ {t('Balanced exchange')}</Txt></Card>}
          <Input label={t('Cash received (XAF)')} keyboardType="number-pad" value={cash} onChangeText={(v) => setCash(v.replace(/[^0-9]/g, ''))} />
          <Txt size="s" muted weight="600">{t('Payment method')}</Txt>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {METHODS.map(([k, label]) => <Button key={k} kind={method === k ? 'primary' : 'ghost'} title={t(label)} onPress={() => setMethod(k)} style={{ flex: 1, paddingHorizontal: 4 }} />)}
          </View>
          <Button title={sending ? t('Sending…') : t('Send handover')} disabled={sending || (!full.length && !empty.length)} onPress={send} style={{ minHeight: 70 }} />
          {!full.length && !empty.length && <Txt color={colors.bad}>{t('Scan at least one bottle.')}</Txt>}
        </ScrollView>
      )}

      {step === 'done' && result && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {result.ok ? (
            <>
              <Card style={{ backgroundColor: colors.okBg, borderColor: colors.ok }}><Txt size="l" color={colors.ok}>✓ {t('Handover recorded')}</Txt></Card>
              <Card style={{ gap: 6 }}>
                <Txt>{t('Full bottles')}: <Txt weight="800">{result.summary.delivered}</Txt>   {t('Empties')}: <Txt weight="800">{result.summary.collected}</Txt></Txt>
                <Txt>{t('Expected cash')}: <Txt weight="800">{Math.round(result.summary.expectedCashXAF).toLocaleString('fr-FR')} XAF</Txt></Txt>
                {result.summary.cashShortfallXAF > 0 && <Txt color={colors.bad} weight="800">{t('Shortfall')}: {Math.round(result.summary.cashShortfallXAF).toLocaleString('fr-FR')} XAF</Txt>}
                {result.summary.deficitCount > 0 && <Txt color={colors.bad} weight="800">{t('Deposit charged')}: {Math.round(result.summary.deficitChargeXAF).toLocaleString('fr-FR')} XAF ({result.summary.deficitCount})</Txt>}
              </Card>
              <Button title={t('Done')} onPress={onBack} />
            </>
          ) : result.queued ? (
            <><Card style={{ borderColor: colors.warn, borderWidth: 2 }}><Txt size="l">{t('Saved on this phone. It will sync when you have network.')}</Txt></Card><Button title={t('Done')} onPress={onBack} /></>
          ) : (
            <>
              <Card style={{ backgroundColor: colors.badBg, borderColor: colors.bad }}><Txt size="l" color={colors.bad}>{t('Handover rejected')}</Txt><Txt color={colors.bad}>{t(result.error)}</Txt></Card>
              {(Array.isArray(result.details) ? result.details : []).map((p, i) => <Card key={i}><Txt weight="800">{p.serial}</Txt><Txt muted>{p.reason}</Txt></Card>)}
              <Button title={t('Fix these bottles')} onPress={fixRejected} />
            </>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
