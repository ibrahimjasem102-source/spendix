"use client";

// Conflict resolution for multi-device sync
// Strategy: Last Write Wins (by updated_at timestamp)
// For manual conflicts, we expose a resolution helper.

export type ConflictStrategy = "last_write_wins" | "server_wins" | "client_wins";

export interface ConflictRecord {
  id:        string;
  table:     string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  localUpdatedAt:  string | number;
  serverUpdatedAt: string | number;
}

export interface ResolvedRecord {
  winner:    "local" | "server";
  data:      Record<string, unknown>;
  strategy:  ConflictStrategy;
}

// Resolve a conflict between local and server versions of a record.
// Default: last write wins (compares updated_at timestamps).
export function resolveConflict(
  conflict: ConflictRecord,
  strategy: ConflictStrategy = "last_write_wins",
): ResolvedRecord {
  switch (strategy) {
    case "server_wins":
      return { winner: "server", data: conflict.serverData, strategy };

    case "client_wins":
      return { winner: "local", data: conflict.localData, strategy };

    case "last_write_wins":
    default: {
      const localTs  = toTimestamp(conflict.localUpdatedAt);
      const serverTs = toTimestamp(conflict.serverUpdatedAt);

      if (localTs >= serverTs) {
        return { winner: "local",  data: conflict.localData,  strategy };
      }
      return { winner: "server", data: conflict.serverData, strategy };
    }
  }
}

function toTimestamp(v: string | number): number {
  if (typeof v === "number") return v;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : 0;
}

// Merge non-conflicting fields from two records.
// Fields only present in one version are taken from that version.
// Fields present in both: use resolver.
export function mergeRecords(
  local:  Record<string, unknown>,
  server: Record<string, unknown>,
  strategy: ConflictStrategy = "last_write_wins",
): Record<string, unknown> {
  const merged = { ...server };  // start from server baseline

  const localTs  = toTimestamp((local.updated_at ?? 0) as string | number);
  const serverTs = toTimestamp((server.updated_at ?? 0) as string | number);

  if (strategy === "client_wins" || (strategy === "last_write_wins" && localTs > serverTs)) {
    // Overwrite with local non-meta fields
    for (const [k, v] of Object.entries(local)) {
      if (k === "id" || k === "user_id" || k === "created_at") continue;
      merged[k] = v;
    }
  }

  return merged;
}

// Detect if two records represent a real conflict (both modified since last sync).
export function isConflict(
  local:  Record<string, unknown>,
  server: Record<string, unknown>,
  lastSyncedAt: number,
): boolean {
  const localTs  = toTimestamp((local.updated_at ?? 0) as string | number);
  const serverTs = toTimestamp((server.updated_at ?? 0) as string | number);
  return localTs > lastSyncedAt && serverTs > lastSyncedAt;
}
