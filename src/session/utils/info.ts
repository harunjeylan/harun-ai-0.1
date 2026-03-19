/**
 * Session utilities - Build session info from files
 */

import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import type { SessionInfo, SessionListProgress, SessionHeader } from "../types";
import { parseSessionEntries } from "./parse";
import type { SessionMessageEntry } from "../types";

const SESSION_EXTENSION = ".jsonl";

/** Extract text content from a message entry */
function extractTextFromMessageEntry(entry: SessionMessageEntry): string {
  return entry.message.content ?? "";
}

/** Build session info from file */
export async function buildSessionInfo(filePath: string): Promise<SessionInfo | null> {
  try {
    const content = await readFile(filePath, "utf8");
    const entries = parseSessionEntries(content);

    if (entries.length === 0) return null;
    const header = entries[0];
    if (header.type !== "session") return null;

    const stats = await stat(filePath);
    let messageCount = 0;
    let firstMessage = "";
    const allMessages: string[] = [];
    let name: string | undefined;

    for (const entry of entries) {
      if (entry.type === "session_info") {
        name = entry.name?.trim() || undefined;
      }

      if (entry.type !== "message") continue;
      messageCount++;

      const textContent = extractTextFromMessageEntry(entry as SessionMessageEntry);
      if (!textContent) continue;

      allMessages.push(textContent);
      if (!firstMessage && entry.message.role === "user") {
        firstMessage = textContent;
      }
    }

    const sessionHeader = header as SessionHeader;
    const cwd = sessionHeader.cwd ?? "";
    const parentSessionPath = sessionHeader.parentSession;

    return {
      path: filePath,
      id: sessionHeader.id,
      cwd,
      name,
      parentSessionPath,
      created: new Date(sessionHeader.timestamp),
      modified: stats.mtime,
      messageCount,
      firstMessage: firstMessage || "(no messages)",
      allMessagesText: allMessages.join(" "),
    };
  } catch {
    return null;
  }
}

/** List sessions from a directory */
export async function listSessionsFromDir(
  dir: string,
  onProgress?: SessionListProgress
): Promise<SessionInfo[]> {
  const sessions: SessionInfo[] = [];
  if (!existsSync(dir)) {
    return sessions;
  }

  try {
    const dirEntries = await readdir(dir);
    const files = dirEntries
      .filter((f) => f.endsWith(SESSION_EXTENSION))
      .map((f) => join(dir, f));
    const total = files.length;

    let loaded = 0;
    const results = await Promise.all(
      files.map(async (file) => {
        const info = await buildSessionInfo(file);
        loaded++;
        onProgress?.(loaded, total);
        return info;
      })
    );
    for (const info of results) {
      if (info) {
        sessions.push(info);
      }
    }
  } catch {
    // Return empty list on error
  }

  return sessions;
}
