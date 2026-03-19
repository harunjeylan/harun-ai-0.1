/**
 * Session Manager
 * Main class for managing conversation sessions
 */

import { mkdir, readdir, readFile, writeFile, unlink } from "fs/promises";
import { mkdirSync, writeFileSync, appendFileSync } from "fs";
import { join, resolve } from "path";
import { randomUUID } from "crypto";
import { existsSync } from "fs";

import type {
  Session,
  SessionEntry,
  SessionSummary,
  SessionTreeNode,
  SessionContext,
  SessionEvent,
  SessionEventListener,
  SessionHeader,
  SessionMessageEntry,
  ThinkingLevelChangeEntry,
  ModelChangeEntry,
  CompactionEntry,
  BranchSummaryEntry,
  CustomEntry,
  CustomMessageEntry,
  LabelEntry,
  SessionInfoEntry,
} from "./types";

import { SESSION_EXTENSION, SESSIONS_DIR, CURRENT_SESSION_VERSION } from "./constants";
import { generateId } from "./utils/id";
import { loadEntriesFromFile, findMostRecentSession } from "./utils/parse";
import { buildSessionContext } from "./core/context";
import { buildTree, getBranchPath } from "./core/tree";

/**
 * Manages conversation sessions as append-only trees stored in JSONL files.
 */
export class SessionManager {
  // Private state
  private sessionId: string = "";
  private sessionFile: string | undefined;
  private sessionsDir: string;
  private cwd: string;
  private persist: boolean;
  private flushed: boolean = false;
  private fileEntries: (SessionHeader | SessionEntry)[] = [];
  private byId: Map<string, SessionEntry> = new Map();
  private labelsById: Map<string, string> = new Map();
  private leafId: string | null = null;
  private listeners: Set<SessionEventListener> = new Set();

  /**
   * Create a new SessionManager instance
   * Use SessionManagerFactory methods instead of calling directly
   */
  constructor(cwd: string, sessionDir: string, sessionFile: string | undefined, persist: boolean) {
    this.cwd = cwd;
    this.sessionsDir = sessionDir;
    this.persist = persist;
    
    if (persist && sessionDir && !existsSync(sessionDir)) {
      mkdirSync(sessionDir, { recursive: true });
    }

    if (sessionFile) {
      this.setSessionFile(sessionFile);
    } else {
      this.newSession();
    }
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  subscribe(listener: SessionEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: SessionEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[SessionManager] Event listener error:", err);
      }
    }
  }

  // ============================================================================
  // Session File Operations
  // ============================================================================

  setSessionFile(sessionFile: string): void {
    this.sessionFile = resolve(sessionFile);
    if (existsSync(this.sessionFile)) {
      const entries = loadEntriesFromFile(this.sessionFile);

      if (entries.length === 0) {
        const explicitPath = this.sessionFile;
        this.newSession();
        this.sessionFile = explicitPath;
        this._rewriteFile();
        this.flushed = true;
        return;
      }

      const header = entries.find((e) => e.type === "session") as SessionHeader | undefined;
      this.sessionId = header?.id ?? randomUUID();
      this.fileEntries = entries as (SessionHeader | SessionEntry)[];
      this._buildIndex();
      this.flushed = true;
    } else {
      const explicitPath = this.sessionFile;
      this.newSession();
      this.sessionFile = explicitPath;
    }

    this.emit({
      type: "session_loaded",
      sessionId: this.sessionId,
    });
  }

  newSession(options?: { id?: string; parentSession?: string }): string | undefined {
    this.sessionId = options?.id ?? randomUUID();
    const timestamp = new Date().toISOString();
    const header: SessionHeader = {
      type: "session",
      version: CURRENT_SESSION_VERSION,
      id: this.sessionId,
      timestamp,
      cwd: this.cwd,
      parentSession: options?.parentSession,
    };
    this.fileEntries = [header];
    this.byId.clear();
    this.labelsById.clear();
    this.leafId = null;
    this.flushed = false;

    if (this.persist) {
      const fileTimestamp = timestamp.replace(/[:.]/g, "-");
      this.sessionFile = join(this.getSessionDir(), `${fileTimestamp}_${this.sessionId}.jsonl`);
    }

    this.emit({
      type: "session_saved",
      sessionId: this.sessionId,
    });

    return this.sessionFile;
  }

  private _buildIndex(): void {
    this.byId.clear();
    this.labelsById.clear();
    this.leafId = null;
    for (const entry of this.fileEntries) {
      if (entry.type === "session") continue;
      const e = entry as SessionEntry;
      this.byId.set(e.id, e);
      this.leafId = e.id;
      if (e.type === "label") {
        const labelEntry = e as LabelEntry;
        if (labelEntry.label) {
          this.labelsById.set(labelEntry.targetId, labelEntry.label);
        } else {
          this.labelsById.delete(labelEntry.targetId);
        }
      }
    }
  }

  private _rewriteFile(): void {
    if (!this.persist || !this.sessionFile) return;
    const content = `${this.fileEntries.map((e) => JSON.stringify(e)).join("\n")}\n`;
    writeFileSync(this.sessionFile, content);
  }

  private _persist(entry: SessionEntry): void {
    if (!this.persist || !this.sessionFile) return;

    const hasAssistant = this.fileEntries.some(
      (e) => e.type === "message" && (e as SessionMessageEntry).message.role === "assistant"
    );
    if (!hasAssistant) {
      this.flushed = false;
      return;
    }

    if (!this.flushed) {
      for (const e of this.fileEntries) {
        appendFileSync(this.sessionFile, `${JSON.stringify(e)}\n`);
      }
      this.flushed = true;
    } else {
      appendFileSync(this.sessionFile, `${JSON.stringify(entry)}\n`);
    }
  }

  private _appendEntry(entry: SessionEntry): void {
    this.fileEntries.push(entry);
    this.byId.set(entry.id, entry);
    this.leafId = entry.id;
    this._persist(entry);

    this.emit({
      type: "entry_added",
      sessionId: this.sessionId,
      entryId: entry.id,
    });
  }

  // ============================================================================
  // Getters
  // ============================================================================

  isPersisted(): boolean { return this.persist; }
  getCwd(): string { return this.cwd; }
  getSessionDir(): string { return this.sessionsDir; }
  getSessionId(): string { return this.sessionId; }
  getSessionFile(): string | undefined { return this.sessionFile; }
  getLeafId(): string | null { return this.leafId; }
  getLeafEntry(): SessionEntry | undefined { return this.leafId ? this.byId.get(this.leafId) : undefined; }
  getEntry(id: string): SessionEntry | undefined { return this.byId.get(id); }
  getLabel(id: string): string | undefined { return this.labelsById.get(id); }

  getEntries(): SessionEntry[] {
    return this.fileEntries.filter((e): e is SessionEntry => e.type !== "session");
  }

  getHeader(): SessionHeader | null {
    const h = this.fileEntries.find((e) => e.type === "session");
    return h ? (h as SessionHeader) : null;
  }

  getSessionName(): string | undefined {
    const entries = this.getEntries();
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.type === "session_info") {
        return (entry as SessionInfoEntry).name?.trim() || undefined;
      }
    }
    return undefined;
  }

  // ============================================================================
  // Entry Appenders
  // ============================================================================

  appendMessage(message: {
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    toolName?: string;
    agentName?: string;
    provider?: string;
    model?: string;
  }): string {
    const entry: SessionMessageEntry = {
      type: "message",
      id: generateId(this.byId),
      parentId: this.leafId,
      timestamp: Date.now(),
      message,
    };
    this._appendEntry(entry);
    return entry.id;
  }

  appendThinkingLevelChange(thinkingLevel: string): string {
    const entry: ThinkingLevelChangeEntry = {
      type: "thinking_level_change",
      id: generateId(this.byId),
      parentId: this.leafId,
      timestamp: Date.now(),
      thinkingLevel: thinkingLevel as ThinkingLevelChangeEntry["thinkingLevel"],
    };
    this._appendEntry(entry);
    return entry.id;
  }

  appendModelChange(provider: string, modelId: string): string {
    const entry: ModelChangeEntry = {
      type: "model_change",
      id: generateId(this.byId),
      parentId: this.leafId,
      timestamp: Date.now(),
      provider,
      modelId,
    };
    this._appendEntry(entry);
    return entry.id;
  }

  appendCompaction(summary: string, firstKeptEntryId: string, tokensBefore: number, details?: unknown, fromHook?: boolean): string {
    const entry: CompactionEntry = {
      type: "compaction",
      id: generateId(this.byId),
      parentId: this.leafId,
      timestamp: Date.now(),
      content: summary,
      metadata: {
        firstKeptEntryId,
        tokensBefore,
        entriesCompacted: 0,
        readFiles: [],
        modifiedFiles: [],
        ...((details as Record<string, unknown>) ?? {}),
      },
    };
    this._appendEntry(entry);
    return entry.id;
  }

  appendCustomEntry(customType: string, data?: unknown): string {
    const entry: CustomEntry = {
      type: "custom",
      customType,
      data,
      id: generateId(this.byId),
      parentId: this.leafId,
      timestamp: Date.now(),
    };
    this._appendEntry(entry);
    return entry.id;
  }

  appendSessionInfo(name: string): string {
    const entry: SessionInfoEntry = {
      type: "session_info",
      id: generateId(this.byId),
      parentId: this.leafId,
      timestamp: Date.now(),
      name: name.trim(),
    };
    this._appendEntry(entry);
    this.emit({ type: "session_info_updated", sessionId: this.sessionId });
    return entry.id;
  }

  appendCustomMessageEntry(customType: string, content: string, display: boolean, details?: unknown): string {
    const entry: CustomMessageEntry = {
      type: "custom_message",
      customType,
      content,
      display,
      details,
      id: generateId(this.byId),
      parentId: this.leafId,
      timestamp: Date.now(),
    };
    this._appendEntry(entry);
    return entry.id;
  }

  appendLabelChange(targetId: string, label: string | undefined): string {
    if (!this.byId.has(targetId)) {
      throw new Error(`Entry ${targetId} not found`);
    }
    const entry: LabelEntry = {
      type: "label",
      id: generateId(this.byId),
      parentId: this.leafId,
      timestamp: Date.now(),
      targetId,
      label,
    };
    this._appendEntry(entry);
    if (label) {
      this.labelsById.set(targetId, label);
    } else {
      this.labelsById.delete(targetId);
    }
    this.emit({ type: "label_changed", sessionId: this.sessionId, entryId: targetId, data: { label } });
    return entry.id;
  }

  // ============================================================================
  // Tree Operations
  // ============================================================================

  getChildren(parentId: string): SessionEntry[] {
    const children: SessionEntry[] = [];
    for (const entry of this.byId.values()) {
      if (entry.parentId === parentId) {
        children.push(entry);
      }
    }
    return children;
  }

  getBranch(fromId?: string): SessionEntry[] {
    return getBranchPath(this.getEntries(), fromId ?? this.leafId, this.byId);
  }

  buildSessionContext(): SessionContext {
    return buildSessionContext(this.getEntries(), this.leafId, this.byId);
  }

  getTree(): SessionTreeNode[] {
    return buildTree(this.getEntries(), this.labelsById);
  }

  // ============================================================================
  // Branching Operations
  // ============================================================================

  branch(branchFromId: string): void {
    if (!this.byId.has(branchFromId)) {
      throw new Error(`Entry ${branchFromId} not found`);
    }
    this.leafId = branchFromId;
  }

  resetLeaf(): void {
    this.leafId = null;
  }

  branchWithSummary(branchFromId: string | null, summary: string, details?: unknown, fromHook?: boolean): string {
    if (branchFromId !== null && !this.byId.has(branchFromId)) {
      throw new Error(`Entry ${branchFromId} not found`);
    }
    this.leafId = branchFromId;
    const entry: BranchSummaryEntry = {
      type: "branch_summary",
      id: generateId(this.byId),
      parentId: branchFromId,
      timestamp: Date.now(),
      content: summary,
      metadata: {
        fromId: branchFromId ?? "root",
        summary,
        details,
        fromHook,
      },
    };
    this._appendEntry(entry);
    return entry.id;
  }

  createBranchedSession(leafId: string): string | undefined {
    const previousSessionFile = this.sessionFile;
    const path = this.getBranch(leafId);
    if (path.length === 0) {
      throw new Error(`Entry ${leafId} not found`);
    }

    const pathWithoutLabels = path.filter((e) => e.type !== "label");
    const newSessionId = randomUUID();
    const timestamp = new Date().toISOString();
    const fileTimestamp = timestamp.replace(/[:.]/g, "-");
    const newSessionFile = join(this.getSessionDir(), `${fileTimestamp}_${newSessionId}.jsonl`);

    const header: SessionHeader = {
      type: "session",
      version: CURRENT_SESSION_VERSION,
      id: newSessionId,
      timestamp,
      cwd: this.cwd,
      parentSession: this.persist ? previousSessionFile : undefined,
    };

    const pathEntryIds = new Set(pathWithoutLabels.map((e) => e.id));
    const labelsToWrite: Array<{ targetId: string; label: string }> = [];
    for (const [targetId, label] of this.labelsById) {
      if (pathEntryIds.has(targetId)) {
        labelsToWrite.push({ targetId, label });
      }
    }

    if (this.persist) {
      const lastEntryId = pathWithoutLabels[pathWithoutLabels.length - 1]?.id || null;
      let parentId = lastEntryId;
      const labelEntries: LabelEntry[] = [];
      for (const { targetId, label } of labelsToWrite) {
        const labelEntry: LabelEntry = {
          type: "label",
          id: generateId(new Set(pathEntryIds)),
          parentId,
          timestamp: Date.now(),
          targetId,
          label,
        };
        pathEntryIds.add(labelEntry.id);
        labelEntries.push(labelEntry);
        parentId = labelEntry.id;
      }

      this.fileEntries = [header, ...pathWithoutLabels, ...labelEntries];
      this.sessionId = newSessionId;
      this.sessionFile = newSessionFile;
      this._buildIndex();

      const hasAssistant = this.fileEntries.some(
        (e) => e.type === "message" && (e as SessionMessageEntry).message.role === "assistant"
      );
      if (hasAssistant) {
        this._rewriteFile();
        this.flushed = true;
      } else {
        this.flushed = false;
      }

      return newSessionFile;
    }

    return undefined;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  static create(cwd: string, sessionDir?: string): SessionManager {
    const dir = sessionDir ?? SESSIONS_DIR;
    return new SessionManager(cwd, dir, undefined, true);
  }

  static open(path: string, sessionDir?: string): SessionManager {
    const entries = loadEntriesFromFile(path);
    const header = entries.find((e) => e.type === "session") as SessionHeader | undefined;
    const cwd = header?.cwd ?? process.cwd();
    const dir = sessionDir ?? resolve(path, "..");
    return new SessionManager(cwd, dir, path, true);
  }

  static continueRecent(cwd: string, sessionDir?: string): SessionManager {
    const dir = sessionDir ?? SESSIONS_DIR;
    const mostRecent = findMostRecentSession(dir);
    if (mostRecent) {
      return new SessionManager(cwd, dir, mostRecent, true);
    }
    return new SessionManager(cwd, dir, undefined, true);
  }

  static inMemory(cwd: string = process.cwd()): SessionManager {
    return new SessionManager(cwd, "", undefined, false);
  }
}

// Re-export types
export * from "./types";
export { SessionManagerFactory } from "./factory";
