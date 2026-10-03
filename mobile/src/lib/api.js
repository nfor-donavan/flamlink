import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

export const BASE = process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.apiUrl) || 'http://10.0.2.2:4000';
const KEY = 'flamlink.session';

export const session = {
  async get() { try { return JSON.parse(await SecureStore.getItemAsync(KEY)); } catch { return null; } },
  set: (s) => SecureStore.setItemAsync(KEY, JSON.stringify(s)),
  clear: () => SecureStore.deleteItemAsync(KEY),
};

export class ApiError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

// status 0 means the network failed (no signal): callers can queue the work and retry later.
export async function api(path, { method = 'GET', body } = {}) {
  const s = await session.get();
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(s ? { Authorization: `Bearer ${s.token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'Request failed', data.details);
  return data;
}

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
