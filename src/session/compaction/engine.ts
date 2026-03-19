/**
 * Context Compaction Engine
 * Manages summarization of older messages to free up context window
 */

import type { SessionEntry, CompactionEntry } from "../types";
import type { CompactionConfig } from "./config";
import {
  estimateEntryTokens,
  calculateContextUsage,
  needsCompaction,
} from "./tokens";
import {
  extractFileOpsFromEntries,
  computeFileLists,
  type FileOperations,
} from "./file-ops";

/**
 * Result of a compaction operation
 */
export interface CompactionResult {
  /** Whether compaction was performed */
  didCompact: boolean;
  /** The compaction entry created (if any) */
  entry?: CompactionEntry;
  /** Number of entries compacted */
  entriesCompacted: number;
  /** Tokens saved */
  tokensSaved: number;
  /** Tokens remaining after compaction */
  tokensAfter: number;
}

/**
 * Compaction Engine
 */
export class CompactionEngine {
  private config: CompactionConfig;

  constructor(config: CompactionConfig) {
    this.config = config;
  }

  /**
   * Check if compaction is needed for the given entries
   */
  checkCompactionNeeded(entries: SessionEntry[]): boolean {
    if (!this.config.enabled) return false;

    const usage = calculateContextUsage(entries);
    return needsCompaction(
      usage,
      this.config.contextWindow,
      this.config.triggerThreshold
    );
  }

  /**
   * Get context usage information
   */
  getContextUsage(entries: SessionEntry[]): {
    tokens: number;
    windowSize: number;
    percentage: number;
    needsCompaction: boolean;
  } {
    const usage = calculateContextUsage(entries);
    const percentage = usage.tokens / this.config.contextWindow;

    return {
      tokens: usage.tokens,
      windowSize: this.config.contextWindow,
      percentage: Math.round(percentage * 100),
      needsCompaction: this.checkCompactionNeeded(entries),
    };
  }

  /**
   * Perform compaction on entries
   * Returns entries that should be kept (including new compaction entry)
   */
  compact(entries: SessionEntry[]): CompactionResult {
    if (!this.config.enabled) {
      return {
        didCompact: false,
        entriesCompacted: 0,
        tokensSaved: 0,
        tokensAfter: calculateContextUsage(entries).tokens,
      };
    }

    // Find the cut point (where to start keeping entries)
    const cutPoint = this.findCutPoint(entries);
    if (cutPoint <= 0) {
      // Nothing to compact
      return {
        didCompact: false,
        entriesCompacted: 0,
        tokensSaved: 0,
        tokensAfter: calculateContextUsage(entries).tokens,
      };
    }

    // Entries to compact
    const entriesToCompact = entries.slice(0, cutPoint);
    const entriesToKeep = entries.slice(cutPoint);

    // Calculate tokens before
    const tokensBefore = calculateContextUsage(entries).tokens;

    // Generate summary
    const summary = this.generateSummary(entriesToCompact);

    // Extract file operations
    const fileOps = extractFileOpsFromEntries(entriesToCompact);
    const { readFiles, modifiedFiles } = computeFileLists(fileOps);

    // Create compaction entry
    const compactionEntry: CompactionEntry = {
      id: `compaction-${Date.now()}`,
      parentId: entriesToKeep[0]?.parentId || null,
      type: "compaction",
      content: summary,
      timestamp: Date.now(),
      metadata: {
        firstKeptEntryId: entriesToKeep[0]?.id || "",
        tokensBefore,
        entriesCompacted: entriesToCompact.length,
        readFiles,
        modifiedFiles,
      },
    };

    // Calculate results
    const newEntries = [compactionEntry, ...entriesToKeep];
    const tokensAfter = calculateContextUsage(newEntries).tokens;

    return {
      didCompact: true,
      entry: compactionEntry,
      entriesCompacted: entriesToCompact.length,
      tokensSaved: tokensBefore - tokensAfter,
      tokensAfter,
    };
  }

  /**
   * Find the index where we should cut (entries before this are compacted)
   * Walks backwards and keeps recent tokens
   */
  private findCutPoint(entries: SessionEntry[]): number {
    let accumulatedTokens = 0;
    const budget = this.config.keepRecentTokens;

    // Walk backwards from the end
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      const entryTokens = estimateEntryTokens(entry);

      // Don't cut in the middle of a tool call/result pair
      if (this.isToolResult(entry) && i > 0) {
        const prevEntry = entries[i - 1];
        if (
          prevEntry?.type === "message" &&
          prevEntry?.message.role === "assistant" &&
          this.hasToolCallForResult(prevEntry, entry)
        ) {
          // Include both the tool call and result
          accumulatedTokens += entryTokens;
          if (accumulatedTokens > budget) {
            return i - 1; // Cut before the tool call
          }
          continue;
        }
      }

      accumulatedTokens += entryTokens;

      if (accumulatedTokens > budget) {
        return i;
      }
    }

    // No cut needed or can't cut (would cut everything)
    return 0;
  }

  /**
   * Check if entry is a tool result
   */
  private isToolResult(entry: SessionEntry): boolean {
    return entry.type === "message" && entry.message.role === "tool";
  }

  /**
   * Check if assistant entry has a tool call that matches a tool result
   */
  private hasToolCallForResult(
    assistantEntry: SessionEntry,
    toolEntry: SessionEntry
  ): boolean {
    if (assistantEntry.type !== "message" || assistantEntry.message.role !== "assistant") return false;
    if (toolEntry.type !== "message" || toolEntry.message.role !== "tool") return false;

    // Check if the tool name matches
    if (toolEntry.message.toolName) {
      // This is a simplified check - in reality you'd match by tool_call_id
      return true;
    }

    return false;
  }

  /**
   * Generate a summary of compacted entries
   * Creates a structured summary in markdown format
   */
  private generateSummary(entries: SessionEntry[]): string {
    const parts: string[] = [];

    // Extract key information
    const goals: string[] = [];
    const progress: string[] = [];
    const decisions: string[] = [];

    for (const entry of entries) {
      if (entry.type === "message" && entry.message.role === "user") {
        // Extract user goals
        const content = entry.message.content.trim();
        if (content.length < 200) {
          goals.push(content);
        }
      } else if (entry.type === "message" && entry.message.role === "assistant") {
        // Extract key assistant responses
        const content = entry.message.content.trim();
        if (content.length < 300) {
          progress.push(content.substring(0, 200));
        }
      }
    }

    // Build summary
    parts.push("## Summary of Previous Work\n");

    if (goals.length > 0) {
      parts.push("### Goals");
      for (const goal of goals.slice(0, 3)) {
        parts.push(`- ${goal}`);
      }
      parts.push("");
    }

    if (progress.length > 0) {
      parts.push("### Progress");
      for (const item of progress.slice(0, 5)) {
        parts.push(`- ${item}${item.length >= 200 ? "..." : ""}`);
      }
      parts.push("");
    }

    // Add file operations info
    const fileOps = extractFileOpsFromEntries(entries);
    const { readFiles, modifiedFiles } = computeFileLists(fileOps);

    if (readFiles.length > 0) {
      parts.push("### Files Read");
      for (const file of readFiles.slice(0, 10)) {
        parts.push(`- ${file}`);
      }
      if (readFiles.length > 10) {
        parts.push(`- ... and ${readFiles.length - 10} more`);
      }
      parts.push("");
    }

    if (modifiedFiles.length > 0) {
      parts.push("### Files Modified");
      for (const file of modifiedFiles.slice(0, 10)) {
        parts.push(`- ${file}`);
      }
      if (modifiedFiles.length > 10) {
        parts.push(`- ... and ${modifiedFiles.length - 10} more`);
      }
      parts.push("");
    }

    return parts.join("\n");
  }
}

/**
 * Create a compaction engine with loaded config
 */
export async function createCompactionEngine(): Promise<CompactionEngine> {
  const { loadCompactionConfig } = await import("./config");
  const config = await loadCompactionConfig();
  return new CompactionEngine(config);
}
