"use client";

const CALLBACK_PATH = "/auth/callback";

export function getOAuthRedirectTo() {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${CALLBACK_PATH}`;
}

export function getPostLoginPath() {
  return "/dashboard";
}
