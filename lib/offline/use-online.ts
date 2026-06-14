"use client";

import { useState, useEffect, useCallback } from "react";

export interface OnlineState {
  isOnline:    boolean;
  wasOffline:  boolean;   // true for one render after coming back online
  lastOnlineAt: Date | null;
  lastOfflineAt: Date | null;
}

// Singleton state — shared across all hook instances
let _listeners: ((state: OnlineState) => void)[] = [];
let _state: OnlineState = {
  isOnline:      typeof navigator !== "undefined" ? navigator.onLine : true,
  wasOffline:    false,
  lastOnlineAt:  null,
  lastOfflineAt: null,
};

function broadcast(next: OnlineState) {
  _state = next;
  for (const fn of _listeners) fn(next);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    broadcast({
      isOnline:      true,
      wasOffline:    !_state.isOnline, // was previously offline
      lastOnlineAt:  new Date(),
      lastOfflineAt: _state.lastOfflineAt,
    });
    // Clear wasOffline flag after next tick
    setTimeout(() => {
      if (_state.wasOffline) broadcast({ ..._state, wasOffline: false });
    }, 500);
  });

  window.addEventListener("offline", () => {
    broadcast({
      isOnline:      false,
      wasOffline:    false,
      lastOnlineAt:  _state.lastOnlineAt,
      lastOfflineAt: new Date(),
    });
  });
}

export function useOnline(): OnlineState {
  const [state, setState] = useState<OnlineState>(_state);

  useEffect(() => {
    // Sync with current singleton state on mount
    setState(_state);
    _listeners.push(setState);
    return () => {
      _listeners = _listeners.filter(fn => fn !== setState);
    };
  }, []);

  return state;
}

// Simpler version for components that only need the boolean
export function useIsOnline(): boolean {
  const { isOnline } = useOnline();
  return isOnline;
}
