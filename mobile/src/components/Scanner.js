import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { usePrefs } from '../lib/prefs';
import { Button, Txt } from './ui';

// Continuous barcode scanner. onScan(serial) returns true when accepted, or a string error to flash.
export default function Scanner({ active, onScan, height = 240 }) {
  const { t, colors } = usePrefs();
  const [perm, ask] = useCameraPermissions();
  const [flash, setFlash] = useState(null);
  const last = useRef({ code: '', at: 0 });

  useEffect(() => { if (!flash) return undefined; const id = setTimeout(() => setFlash(null), 1400); return () => clearTimeout(id); }, [flash]);

  if (!perm) return <View style={{ height }} />;
  if (!perm.granted) {
    return (
      <View style={[st.box, { height, borderColor: colors.line, padding: 16, gap: 12 }]}>
        <Txt muted>{t('Camera permission is needed to scan bottles.')}</Txt>
        <Button title={t('Allow camera')} onPress={ask} />
      </View>
    );
  }
  const handle = ({ data }) => {
    const code = String(data || '').trim().toUpperCase();
    const now = Date.now();
    if (!code || (code === last.current.code && now - last.current.at < 2000)) return; // same bottle still in view
    last.current = { code, at: now };
    const res = onScan(code);
    if (res === true) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setFlash({ ok: true, text: code }); }
    else { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); setFlash({ ok: false, text: `${code}: ${res}` }); }
  };
  return (
    <View style={[st.box, { height, borderColor: flash ? (flash.ok ? colors.ok : colors.bad) : colors.line }]}>
      {active && <CameraView style={StyleSheet.absoluteFill} facing="back" onBarcodeScanned={handle}
        barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'code93', 'ean13', 'ean8', 'upc_a', 'qr', 'datamatrix', 'itf14'] }} />}
      <View pointerEvents="none" style={st.reticle} />
      {flash && <View style={[st.flash, { backgroundColor: flash.ok ? colors.ok : colors.bad }]}><Txt weight="800" color="#fff" numberOfLines={1}>{flash.ok ? '✓ ' : '✕ '}{flash.text}</Txt></View>}
    </View>
  );
}
const st = StyleSheet.create({
  box: { borderRadius: 16, borderWidth: 4, overflow: 'hidden', backgroundColor: '#000', justifyContent: 'center' },
  reticle: { position: 'absolute', left: '12%', right: '12%', top: '30%', bottom: '30%', borderWidth: 2, borderColor: '#ffffffcc', borderRadius: 10 },
  flash: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10 },
});
