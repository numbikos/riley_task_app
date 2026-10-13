import type { User } from '../types';

const AUTH_EVENT = 'riley-auth-change';
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`/api${path}`, {
      ...options, credentials: 'same-origin', signal: options.signal ?? controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'RileyTaskApp', ...options.headers },
    });
    if (!response.ok) {
      if (response.status === 401 && path !== '/auth/login') notifyAuth(null);
      const body = await response.json().catch(() => null);
      throw new ApiError(body?.error ?? 'Could not connect. Please try again.', response.status);
    }
    return response.status === 204 ? undefined as T : await response.json() as T;
  } finally { window.clearTimeout(timeout); }
}
export function notifyAuth(user: User | null) { window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: user })); }
export function subscribeAuth(callback: (user: User | null) => void) {
  const listener = (event: Event) => callback((event as CustomEvent<User | null>).detail);
  window.addEventListener(AUTH_EVENT, listener);
  return () => window.removeEventListener(AUTH_EVENT, listener);
}
export async function signIn(username: string, password: string) {
  const { user } = await apiRequest<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  notifyAuth(user);
}
export async function signOut() {
  await apiRequest('/auth/logout', { method: 'POST' });
  notifyAuth(null);
}
export function subscribeTaskChanges(callback: () => void) {
  const timer = window.setInterval(() => { if (!document.hidden) callback(); }, 15000);
  return () => window.clearInterval(timer);
}
