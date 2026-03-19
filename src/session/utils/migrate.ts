/**
 * Session utilities - Migration functions
 */

import type {
  FileEntry,
  SessionHeader,
  SessionEntry,
  LegacySessionEntry,
  SessionMessageEntry,
} from "../types";
import { CURRENT_SESSION_VERSION } from "../types";
import { generateId } from "./id";

/** Migrate v1 → v2: add id/parentId tree structure. Mutates in place. */
export function migrateV1ToV2(entries: FileEntry[]): void {
  const ids = new Set<string>();
  let prevId: string | null = null;

  for (const entry of entries) {
    if (entry.type === "session") {
      (entry as SessionHeader).version = 2;
      continue;
    }

    (entry as SessionEntry).id = generateId(ids);
    (entry as SessionEntry).parentId = prevId;
    prevId = (entry as SessionEntry).id;

    // Convert legacy entries to new format
    const legacy = entry as LegacySessionEntry;
    if (
      legacy.type === "user" ||
      legacy.type === "assistant" ||
      legacy.type === "tool" ||
      legacy.type === "system"
    ) {
      (entry as unknown as SessionMessageEntry).type = "message";
      (entry as unknown as SessionMessageEntry).message = {
        role: legacy.type,
        content: legacy.content,
        toolName: legacy.toolName,
        agentName: legacy.agentName,
      };
      // Remove old fields
      delete (entry as Partial<LegacySessionEntry>).content;
      delete (entry as Partial<LegacySessionEntry>).toolName;
      delete (entry as Partial<LegacySessionEntry>).agentName;
    }
  }
}

/**
 * Run all necessary migrations to bring entries to current version.
 * Mutates entries in place. Returns true if any migration was applied.
 */
export function migrateToCurrentVersion(entries: FileEntry[]): boolean {
  const header = entries.find((e) => e.type === "session") as
    | SessionHeader
    | undefined;
  const version = header?.version ?? 1;

  if (version >= CURRENT_SESSION_VERSION) return false;

  if (version < 2) migrateV1ToV2(entries);

  return true;
}
