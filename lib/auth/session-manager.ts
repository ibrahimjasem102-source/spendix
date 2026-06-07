"use client";

import { setAuthToken, clearTokens, storeRefreshToken, getAuthToken } from "./token-store";

export function initSession(): boolean {
  return !!getAuthToken();
}

export function signedIn(accessToken: string, refreshToken?: string) {
  setAuthToken(accessToken);
  if (refreshToken) storeRefreshToken(refreshToken);
}

export function signedOut() {
  clearTokens();
}
