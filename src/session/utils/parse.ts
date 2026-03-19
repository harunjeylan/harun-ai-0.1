/**
 * Session utilities - File parsing and loading
 */

import { readFileSync, readdirSync, statSync, openSync, closeSync, readSync } from "fs";
import { join } from "path";
import type { FileEntry, SessionHeader } from "../types";
import { migrateToCurrentVersion } from "./migrate";

const SESSION_EXTENSION = ".jsonl";

/** Parse session entries from file content */
export function parseSessionEntries(content: string): FileEntry[] {
  const entries: FileEntry[] = [];
  const lines = content.trim().split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as FileEntry;
      entries.push(entry);
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}

/** Load entries from a file path */
export function loadEntriesFromFile(filePath: string): FileEntry[] {
  if (!existsSync(filePath)) return [];

  const content = readFileSync(filePath, "utf8");
  const entries = parseSessionEntries(content);

  // Validate session header
  if (entries.length === 0) return entries;
  const header = entries[0];
  if (header.type !== "session" || typeof (header as SessionHeader).id !== "string") {
    return [];
  }

  // Migrate if needed
  migrateToCurrentVersion(entries);

  return entries;
}

/** Check if a file is a valid session file */
export function isValidSessionFile(filePath: string): boolean {
  try {
    const fd = openSync(filePath, "r");
    const buffer = Buffer.alloc(512);
    const bytesRead = readSync(fd, buffer, 0, 512, 0);
    closeSync(fd);
    const firstLine = buffer.toString("utf8", 0, bytesRead).split("\n")[0];
    if (!firstLine) return false;
    const header = JSON.parse(firstLine);
    return header.type === "session" && typeof header.id === "string";
  } catch {
    return false;
  }
}

/** Find the most recent session in a directory */
export function findMostRecentSession(sessionDir: string): string | null {
  try {
    const files = readdirSync(sessionDir)
      .filter((f) => f.endsWith(SESSION_EXTENSION))
      .map((f) => join(sessionDir, f))
      .filter(isValidSessionFile)
      .map((path) => ({ path, mtime: statSync(path).mtime }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    return files[0]?.path || null;
  } catch {
    return null;
  }
}

import { existsSync } from "fs";
