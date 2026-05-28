"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ROUTES, type NavItem } from "@/lib/routes";

export type LockedRoomId = "primary" | "finance" | "ai" | "system";

type RoomLockMap = Record<LockedRoomId, boolean>;

interface RoomLockConfig {
  pin: string;
  rooms: RoomLockMap;
}

interface RoomDefinition {
  id: LockedRoomId;
  labelKey: string;
  descriptionKey: string;
  routes: string[];
}

interface RoomLockContextValue {
  ready: boolean;
  config: RoomLockConfig;
  hasPin: boolean;
  setRoomLocked: (room: LockedRoomId, locked: boolean) => void;
  setPin: (pin: string) => boolean;
  clearPin: () => void;
  unlockRoom: (room: LockedRoomId, pin: string) => boolean;
  lockRoom: (room: LockedRoomId) => void;
  lockAllRooms: () => void;
  isRoomLocked: (room: LockedRoomId | null | undefined) => boolean;
  isRoomUnlocked: (room: LockedRoomId | null | undefined) => boolean;
}

const STORAGE_KEY = "spendix_locked_rooms";
const SESSION_PREFIX = "spendix_room_unlocked_";

const defaultRooms: RoomLockMap = {
  primary: false,
  finance: false,
  ai: false,
  system: false,
};

const defaultConfig: RoomLockConfig = {
  pin: "",
  rooms: defaultRooms,
};

export const ROOM_DEFINITIONS: RoomDefinition[] = [
  {
    id: "primary",
    labelKey: "rooms.primary",
    descriptionKey: "rooms.primary_desc",
    routes: [ROUTES.dashboard, ROUTES.transactions, ROUTES.analytics],
  },
  {
    id: "finance",
    labelKey: "rooms.finance",
    descriptionKey: "rooms.finance_desc",
    routes: [ROUTES.budgets, ROUTES.goals, ROUTES.investments, ROUTES.debts, ROUTES.work, ROUTES.ledger],
  },
  {
    id: "ai",
    labelKey: "rooms.ai",
    descriptionKey: "rooms.ai_desc",
    routes: [ROUTES.aiInsights, ROUTES.aiAssistant],
  },
  {
    id: "system",
    labelKey: "rooms.system",
    descriptionKey: "rooms.system_desc",
    routes: [ROUTES.notifications, ROUTES.settings, ROUTES.more],
  },
];

const RoomLockContext = createContext<RoomLockContextValue | null>(null);

function normalizeConfig(value: unknown): RoomLockConfig {
  if (!value || typeof value !== "object") return defaultConfig;

  const candidate = value as Partial<RoomLockConfig>;
  return {
    pin: typeof candidate.pin === "string" ? candidate.pin : "",
    rooms: {
      primary: Boolean(candidate.rooms?.primary),
      finance: Boolean(candidate.rooms?.finance),
      ai: Boolean(candidate.rooms?.ai),
      system: Boolean(candidate.rooms?.system),
    },
  };
}

function readSessionUnlocked(room: LockedRoomId) {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(`${SESSION_PREFIX}${room}`) === "1";
}

function writeSessionUnlocked(room: LockedRoomId, unlocked: boolean) {
  if (typeof window === "undefined") return;
  const key = `${SESSION_PREFIX}${room}`;
  if (unlocked) {
    window.sessionStorage.setItem(key, "1");
  } else {
    window.sessionStorage.removeItem(key);
  }
}

export function getRoomForPath(pathname: string): LockedRoomId | null {
  const match = ROOM_DEFINITIONS.find((room) =>
    room.routes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  );
  return match?.id ?? null;
}

export function getRoomForNavItem(item: NavItem): LockedRoomId | null {
  return getRoomForPath(item.href);
}

export function RoomLockProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [config, setConfigState] = useState<RoomLockConfig>(defaultConfig);
  const [unlocked, setUnlocked] = useState<RoomLockMap>(defaultRooms);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setConfigState(normalizeConfig(JSON.parse(saved)));
      } catch {
        setConfigState(defaultConfig);
      }
    }

    setUnlocked({
      primary: readSessionUnlocked("primary"),
      finance: readSessionUnlocked("finance"),
      ai: readSessionUnlocked("ai"),
      system: readSessionUnlocked("system"),
    });
    setReady(true);
  }, []);

  const persist = useCallback((next: RoomLockConfig) => {
    setConfigState(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const setRoomLocked = useCallback((room: LockedRoomId, locked: boolean) => {
    persist({
      ...config,
      rooms: { ...config.rooms, [room]: locked },
    });
    if (!locked) {
      writeSessionUnlocked(room, false);
      setUnlocked((current) => ({ ...current, [room]: false }));
    }
  }, [config, persist]);

  const setPin = useCallback((pin: string) => {
    const nextPin = pin.trim();
    if (nextPin.length < 4) return false;
    persist({ ...config, pin: nextPin });
    return true;
  }, [config, persist]);

  const clearPin = useCallback(() => {
    ROOM_DEFINITIONS.forEach((room) => writeSessionUnlocked(room.id, false));
    setUnlocked(defaultRooms);
    persist(defaultConfig);
  }, [persist]);

  const unlockRoom = useCallback((room: LockedRoomId, pin: string) => {
    if (!config.pin || pin !== config.pin) return false;
    writeSessionUnlocked(room, true);
    setUnlocked((current) => ({ ...current, [room]: true }));
    return true;
  }, [config.pin]);

  const lockRoom = useCallback((room: LockedRoomId) => {
    writeSessionUnlocked(room, false);
    setUnlocked((current) => ({ ...current, [room]: false }));
  }, []);

  const lockAllRooms = useCallback(() => {
    ROOM_DEFINITIONS.forEach((room) => writeSessionUnlocked(room.id, false));
    setUnlocked(defaultRooms);
  }, []);

  const value = useMemo<RoomLockContextValue>(() => ({
    ready,
    config,
    hasPin: config.pin.length >= 4,
    setRoomLocked,
    setPin,
    clearPin,
    unlockRoom,
    lockRoom,
    lockAllRooms,
    isRoomLocked: (room) => Boolean(room && config.pin && config.rooms[room]),
    isRoomUnlocked: (room) => Boolean(room && unlocked[room]),
  }), [clearPin, config, lockAllRooms, lockRoom, ready, setPin, setRoomLocked, unlockRoom, unlocked]);

  return <RoomLockContext.Provider value={value}>{children}</RoomLockContext.Provider>;
}

export function useRoomLocks() {
  const context = useContext(RoomLockContext);
  if (!context) {
    throw new Error("useRoomLocks must be used inside RoomLockProvider");
  }
  return context;
}
