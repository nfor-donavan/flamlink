const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const KEY = 'flamlink.session';

export const session = {
  get: () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set: (s) => localStorage.setItem(KEY, JSON.stringify(s)),
  clear: () => localStorage.removeItem(KEY),
};

export class ApiError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

export async function api(path, { method = 'GET', body, params } = {}) {
  const s = session.get();
  const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)) : '';
  const res = await fetch(`${BASE}/api${path}${qs}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(s ? { Authorization: `Bearer ${s.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && s) { session.clear(); window.location.assign('/login'); }
  if (!res.ok) throw new ApiError(res.status, data.error || 'Request failed', data.details);
  return data;
}
