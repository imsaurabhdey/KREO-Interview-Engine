/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side authenticated fetch helper & session token manager.
 * Sends credentials (HttpOnly cookie) + Authorization Bearer token and
 * triggers session expiry callbacks cleanly on 401 responses.
 */

import SafeStorage from './safeStorage';

const AUTH_TOKEN_KEY = 'kreo_auth_token';

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function getAuthToken(): string | null {
  return SafeStorage.getItem(AUTH_TOKEN_KEY, 'sessionStorage');
}

export function setAuthToken(token: string) {
  SafeStorage.setItem(AUTH_TOKEN_KEY, token, 'sessionStorage');
}

export function clearAuthToken() {
  SafeStorage.removeItem(AUTH_TOKEN_KEY, 'sessionStorage');
}

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function notifyUnauthorized() {
  clearAuthToken();
  unauthorizedListeners.forEach((cb) => {
    try {
      cb();
    } catch (err) {
      console.warn('[authFetch] Unauthorized listener error:', err);
    }
  });
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: 'same-origin'
  });

  if (response.status === 401) {
    const urlStr = typeof input === 'string' ? input : input.toString();
    // Don't force-logout on login, wrong current-password submission, or candidate interview token endpoints
    if (
      !urlStr.includes('/api/auth/login') &&
      !urlStr.includes('/api/auth/change-password') &&
      !urlStr.includes('/api/interview/')
    ) {
      notifyUnauthorized();
    }
  }

  return response;
}
