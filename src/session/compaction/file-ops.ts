/**
 * File operations tracking for context compaction
 * Tracks which files have been read/written/edited cumulatively
 */

import type { SessionEntry } from "../types";

/**
 * File operations tracking
 */
export interface FileOperations {
  /** Files that were read */
  read: Set<string>;
  /** Files that were created */
  written: Set<string>;
  /** Files that were modified */
  edited: Set<string>;
}

/**
 * Create empty file operations
 */
export function createFileOperations(): FileOperations {
  return {
    read: new Set(),
    written: new Set(),
    edited: new Set(),
  };
}

/**
 * Extract file operations from a tool entry
 */
export function extractFileOpsFromEntry(entry: SessionEntry): FileOperations {
  const ops = createFileOperations();

  if (entry.type !== "message" || entry.message.role !== "tool" || !entry.message.toolName) {
    return ops;
  }

  const content = entry.message.content;
  const toolName = entry.message.toolName;

  // Parse parameters from content (format: toolName({...params}))
  const paramMatch = content.match(/\((.*)\)$/s);
  if (!paramMatch) return ops;

  let params: Record<string, unknown> = {};
  try {
    params = JSON.parse(paramMatch[1]);
  } catch {
    // If not valid JSON, try to extract path manually
    const pathMatch = content.match(/path["\']?\s*:\s*["\']([^"\']+)["\']/);
    if (pathMatch) {
      params = { path: pathMatch[1] };
    }
  }

  const path = params.path as string | undefined;
  if (!path) return ops;

  switch (toolName) {
    case "read":
    case "read_file":
      ops.read.add(path);
      break;

    case "write":
    case "write_file":
      ops.written.add(path);
      // Also mark as edited (written implies modified)
      ops.edited.add(path);
      break;

    case "edit":
    case "apply_diff":
    case "applyDiff":
      ops.edited.add(path);
      break;

    case "glob":
    case "find":
    case "ls":
    case "list_directory":
      // Directory operations - don't track as file reads
      break;

    default:
      // For unknown tools, check if they have a path parameter
      if (path) {
        ops.read.add(path);
      }
  }

  return ops;
}

/**
 * Merge multiple file operations
 */
export function mergeFileOps(...operations: FileOperations[]): FileOperations {
  const merged = createFileOperations();

  for (const ops of operations) {
    for (const path of ops.read) {
      merged.read.add(path);
    }
    for (const path of ops.written) {
      merged.written.add(path);
    }
    for (const path of ops.edited) {
      merged.edited.add(path);
    }
  }

  return merged;
}

/**
 * Compute final file lists
 * - readFiles: files only read (not modified)
 * - modifiedFiles: files that were edited or written
 */
export function computeFileLists(
  ops: FileOperations
): { readFiles: string[]; modifiedFiles: string[] } {
  // Modified files are edited or written
  const modifiedFiles = new Set([...ops.edited, ...ops.written]);

  // Read files are those only read (not modified)
  const readFiles = [...ops.read].filter((path) => !modifiedFiles.has(path));

  return {
    readFiles: [...readFiles].sort(),
    modifiedFiles: [...modifiedFiles].sort(),
  };
}

/**
 * Extract file operations from multiple entries
 */
export function extractFileOpsFromEntries(
  entries: SessionEntry[]
): FileOperations {
  const ops = createFileOperations();

  for (const entry of entries) {
    if (entry.type === "message" && entry.message.role === "tool") {
      const entryOps = extractFileOpsFromEntry(entry);
      const merged = mergeFileOps(ops, entryOps);
      ops.read = merged.read;
      ops.written = merged.written;
      ops.edited = merged.edited;
    }
  }

  return ops;
}

/**
 * Serialize file operations for storage
 */
export function serializeFileOps(ops: FileOperations): {
  read: string[];
  written: string[];
  edited: string[];
} {
  return {
    read: [...ops.read].sort(),
    written: [...ops.written].sort(),
    edited: [...ops.edited].sort(),
  };
}

/**
 * Deserialize file operations from storage
 */
export function deserializeFileOps(data: {
  read?: string[];
  written?: string[];
  edited?: string[];
}): FileOperations {
  return {
    read: new Set(data.read || []),
    written: new Set(data.written || []),
    edited: new Set(data.edited || []),
  };
}
