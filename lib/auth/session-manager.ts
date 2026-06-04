"use client";

/**
 * Centralised session manager — single source of truth for auth state.
 * Reads/writes spendix_access_token in localStorage.
 * Exposes callbacks so any component can react to auth changes.
 */

import { setAuthToken, getAuthToken } from "./token-store";

type Listener = (authenticated: boolean) => void;
const listeners = new Set<Listener>();

let _isAuthenticated: boolean | null = null; // null = not yet known

function notify(auth: boolean) {
  _isAuthenticated = auth;
  listeners.forEach((fn) => fn(auth));
}

/** Call once on app boot to initialise session state synchronously */
export function initSession(): boolean {
  const token = getAuthToken(); // reads spendix_access_token or Supabase key
  const auth  = !!token;
  _isAuthenticated = auth;
  return auth;
}

export function getIsAuthenticated() {
  return _isAuthenticated;
}

export function onAuthChange(fn: Listener) {
  listeners.add(fn);
  // Fire immediately if state already known
  if (_isAuthenticated !== null) fn(_isAuthenticated);
  return () => listeners.delete(fn);
}

export function signedIn(token: string) {
  setAuthToken(token);
  notify(true);
}

export function signedOut() {
  setAuthToken(null);
  notify(false);
}
