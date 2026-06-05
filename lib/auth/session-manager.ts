"use client";

import { setAuthToken, clearTokens, storeRefreshToken, getAuthToken } from "./token-store";

export function initSession(): boolean {
  const token = getAuthToken();
  const has = !!token;
  console.log("[auth] initSession — hasToken:", has);
  return has;
}

export function signedIn(accessToken: string, refreshToken?: string) {
  setAuthToken(accessToken);
  if (refreshToken) storeRefreshToken(refreshToken);
  console.log("[auth] signedIn — token stored");
}

export function signedOut() {
  clearTokens(); // only called on EXPLICIT logout
}
