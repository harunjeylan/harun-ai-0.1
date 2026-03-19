/**
 * Session module - exports
 */

// Main classes and factories
export { SessionManager } from "./manager";
export { SessionManagerFactory } from "./factory";

// Types
export type {
  Session,
  SessionEntry,
  SessionSummary,
  SessionInfo,
  SessionTreeNode,
  SessionContext,
  SessionBranch,
  SessionEvent,
  SessionEventListener,
  SessionListProgress,
  FileEntry,
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

// Constants
export { SESSIONS_DIR, SESSION_EXTENSION, CURRENT_SESSION_VERSION } from "./constants";
