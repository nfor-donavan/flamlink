import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from './api';

const KEY = 'flamlink.handoverQueue';
const read = async () => { try { return JSON.parse(await AsyncStorage.getItem(KEY)) || []; } catch { return []; } };
const write = (q) => AsyncStorage.setItem(KEY, JSON.stringify(q));

export const pendingCount = async () => (await read()).length;

// Sends one handover. On a network failure it stays in the queue; the same idempotencyKey makes retries safe.
export async function submitHandover(payload) {
  const q = await read();
  q.push(payload);
  await write(q);
  const results = await flush();
  return results.find((r) => r.key === payload.idempotencyKey) || { key: payload.idempotencyKey, queued: true };
}

let flushing = false;
export async function flush() {
  if (flushing) return [];
  flushing = true;
  const results = [];
  try {
    const q = await read();
    const rest = [];
    for (const item of q) {
      try {
        const r = await api('/handovers', { method: 'POST', body: item });
        results.push({ key: item.idempotencyKey, ok: true, summary: r.summary });
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) { rest.push(item); results.push({ key: item.idempotencyKey, queued: true }); }
        else if (e instanceof ApiError && e.status >= 500) rest.push(item);
        else results.push({ key: item.idempotencyKey, ok: false, error: e.message, details: e.details }); // 4xx: the server rejected it, drop it
      }
    }
    await write(rest);
  } finally { flushing = false; }
  return results;
}
