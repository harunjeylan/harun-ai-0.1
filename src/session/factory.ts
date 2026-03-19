/**
 * Session factory - Static factory methods for creating SessionManager instances
 */

import { mkdirSync, appendFileSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import type { SessionInfo, SessionListProgress, SessionHeader } from "./types";
import { SESSION_EXTENSION, SESSIONS_DIR } from "./constants";
import { SessionManager } from "./manager";
import {
  loadEntriesFromFile,
  findMostRecentSession,
} from "./utils/parse";
import { listSessionsFromDir } from "./utils/info";

export interface SessionManagerFactory {
  /**
   * Create a new session.
   * @param cwd Working directory (stored in session header)
   * @param sessionDir Optional session directory
   */
  create(cwd: string, sessionDir?: string): SessionManager;

  /**
   * Open a specific session file.
   * @param path Path to session file
   * @param sessionDir Optional session directory for new/branch
   */
  open(path: string, sessionDir?: string): SessionManager;

  /**
   * Continue the most recent session, or create new if none.
   * @param cwd Working directory
   * @param sessionDir Optional session directory
   */
  continueRecent(cwd: string, sessionDir?: string): SessionManager;

  /**
   * Create an in-memory session (no file persistence)
   */
  inMemory(cwd?: string): SessionManager;

  /**
   * Fork a session from another project directory into the current project.
   * @param sourcePath Path to the source session file
   * @param targetCwd Target working directory
   * @param sessionDir Optional session directory
   */
  forkFrom(sourcePath: string, targetCwd: string, sessionDir?: string): SessionManager;

  /**
   * List all sessions for a directory.
   * @param cwd Working directory (for context)
   * @param sessionDir Optional session directory
   * @param onProgress Optional callback for progress updates
   */
  list(cwd: string, sessionDir?: string, onProgress?: SessionListProgress): Promise<SessionInfo[]>;

  /**
   * List all sessions across all project directories.
   */
  listAll(onProgress?: SessionListProgress): Promise<SessionInfo[]>;
}

export const SessionManagerFactory: SessionManagerFactory = {
  create(cwd: string, sessionDir?: string): SessionManager {
    const dir = sessionDir ?? SESSIONS_DIR;
    return SessionManager.create(cwd, dir);
  },

  open(path: string, sessionDir?: string): SessionManager {
    return SessionManager.open(path, sessionDir);
  },

  continueRecent(cwd: string, sessionDir?: string): SessionManager {
    const dir = sessionDir ?? SESSIONS_DIR;
    return SessionManager.continueRecent(cwd, dir);
  },

  inMemory(cwd: string = process.cwd()): SessionManager {
    return SessionManager.inMemory(cwd);
  },

  forkFrom(sourcePath: string, targetCwd: string, sessionDir?: string): SessionManager {
    const sourceEntries = loadEntriesFromFile(sourcePath);
    if (sourceEntries.length === 0) {
      throw new Error(`Cannot fork: source session file is empty or invalid: ${sourcePath}`);
    }

    const sourceHeader = sourceEntries.find((e) => e.type === "session") as SessionHeader | undefined;
    if (!sourceHeader) {
      throw new Error(`Cannot fork: source session has no header: ${sourcePath}`);
    }

    const dir = sessionDir ?? SESSIONS_DIR;
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Create new session file with new ID but forked content
    const newSessionId = randomUUID();
    const timestamp = new Date().toISOString();
    const fileTimestamp = timestamp.replace(/[:.]/g, "-");
    const newSessionFile = join(dir, `${fileTimestamp}_${newSessionId}.jsonl`);

    // Write new header pointing to source as parent
    const newHeader: SessionHeader = {
      type: "session",
      version: 2,
      id: newSessionId,
      timestamp,
      cwd: targetCwd,
      parentSession: sourcePath,
    };

    appendFileSync(newSessionFile, `${JSON.stringify(newHeader)}\n`);

    // Copy all non-header entries from source
    for (const entry of sourceEntries) {
      if (entry.type !== "session") {
        appendFileSync(newSessionFile, `${JSON.stringify(entry)}\n`);
      }
    }

    return new SessionManager(targetCwd, dir, newSessionFile, true);
  },

  async list(
    cwd: string,
    sessionDir?: string,
    onProgress?: SessionListProgress
  ): Promise<SessionInfo[]> {
    const dir = sessionDir ?? SESSIONS_DIR;
    const sessions = await listSessionsFromDir(dir, onProgress);
    sessions.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    return sessions;
  },

  async listAll(onProgress?: SessionListProgress): Promise<SessionInfo[]> {
    const sessions = await listSessionsFromDir(SESSIONS_DIR, onProgress);
    sessions.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    return sessions;
  },
};
