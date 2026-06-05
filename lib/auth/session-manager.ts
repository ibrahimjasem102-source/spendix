"use client";

import { setAuthToken, clearTokens, storeRefreshToken, getAuthToken } from "./token-store";

type Listener = (authenticated: boolean) => void;
const listeners = new Set<Listener>();

function notify(auth: boolean) {
  listeners.forEach((fn) => fn(auth));
}

export function initSession(): boolean {
  const token = getAuthToken();
  return !!token;
}

export function onAuthChange(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function signedIn(accessToken: string, refreshToken?: string) {
  setAuthToken(accessToken);
  if (refreshToken) storeRefreshToken(refreshToken);
  notify(true);
}

export function signedOut() {
  clearTokens();
  notify(false);
}
