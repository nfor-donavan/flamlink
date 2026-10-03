import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { PrefsProvider, usePrefs } from './src/lib/prefs';
import { api, session } from './src/lib/api';
import { flush } from './src/lib/queue';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import HandoverScreen from './src/screens/HandoverScreen';
import LookupScreen from './src/screens/LookupScreen';
import ReportScreen from './src/screens/ReportScreen';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }) });

// While a driver is signed in: share the position (so the nearest truck is chosen) and register for push alerts.
function useDriverSetup(user) {
  useEffect(() => {
    if (!user || user.role !== 'driver') return undefined;
    let timer;
    (async () => {
      try {
        if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('dispatch', { name: 'Dispatch', importance: Notifications.AndroidImportance.MAX });
        const perm = await Notifications.requestPermissionsAsync();
        if (perm.granted) {
          const projectId = Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.eas && Constants.expoConfig.extra.eas.projectId;
          const tok = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
          await api('/auth/me/push-token', { method: 'PUT', body: { token: tok.data } });
        }
      } catch { /* push is optional: the app also polls for orders */ }
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const ping = async () => {
          try {
            const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            await api('/auth/me/location', { method: 'POST', body: { lat: p.coords.latitude, lng: p.coords.longitude } });
          } catch { /* offline or no GPS fix */ }
        };
        ping(); timer = setInterval(ping, 60000);
      } catch { /* ignore */ }
    })();
    return () => timer && clearInterval(timer);
  }, [user && user.id]); // eslint-disable-line
}

function Root() {
  const { ready, theme, colors } = usePrefs();
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [screen, setScreen] = useState('home');
  useEffect(() => { session.get().then((s) => setUser(s ? s.user : null)); }, []);
  useDriverSetup(user);
  const back = useCallback(() => setScreen('home'), []);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (screen !== 'home') { setScreen('home'); return true; } return false; });
    return () => sub.remove();
  }, [screen]);
  const logout = async () => { await session.clear(); setUser(null); setScreen('home'); };

  if (!ready || user === undefined) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator color={colors.flame} size="large" /></View>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      {!user ? <LoginScreen onLoggedIn={(d) => { setUser(d.user); flush(); }} />
        : screen === 'handover' ? <HandoverScreen onBack={back} />
        : screen === 'lookup' ? <LookupScreen onBack={back} />
        : screen === 'report' ? <ReportScreen onBack={back} />
        : <HomeScreen user={user} go={setScreen} onLogout={logout} />}
    </View>
  );
}

export default function App() { return <PrefsProvider><Root /></PrefsProvider>; }
