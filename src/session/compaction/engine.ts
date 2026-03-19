/**
 * Context Compaction Engine
 * Manages summarization of older messages to free up context window
 */

import type { Model } from "@mariozechner/pi-ai";
import { completeSimple } from "@mariozechner/pi-ai";
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
import {
  SUMMARIZATION_PROMPT,
  UPDATE_SUMMARIZATION_PROMPT,
  SUMMARIZATION_SYSTEM_PROMPT,
} from "./prompts";

/**
 * LLM configuration for summarization
 */
export interface LLMConfig {
  apiKey: string;
  model: Model<any>;
}

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
  /** Whether LLM summarization was used */
  usedLlm?: boolean;
}

/**
 * Compaction Engine
 */
export class CompactionEngine {
  private config: CompactionConfig;
  private llmConfig?: LLMConfig;

  constructor(config: CompactionConfig, llmConfig?: LLMConfig) {
    this.config = config;
    this.llmConfig = llmConfig;
  }

  /**
   * Set LLM config for summarization
   */
  setLLMConfig(llmConfig: LLMConfig): void {
    this.llmConfig = llmConfig;
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

    const cutPoint = this.findCutPoint(entries);
    if (cutPoint <= 0) {
      return {
        didCompact: false,
        entriesCompacted: 0,
        tokensSaved: 0,
        tokensAfter: calculateContextUsage(entries).tokens,
      };
    }

    const entriesToCompact = entries.slice(0, cutPoint);
    const entriesToKeep = entries.slice(cutPoint);
    const tokensBefore = calculateContextUsage(entries).tokens;

    // Generate summary (LLM if available, otherwise simple)
    const summary = this.generateSummary(entriesToCompact);

    // Extract file operations
    const fileOps = extractFileOpsFromEntries(entriesToCompact);
    const { readFiles, modifiedFiles } = computeFileLists(fileOps);

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
   * Async compaction with LLM summarization
   */
  async compactAsync(entries: SessionEntry[], previousSummary?: string): Promise<CompactionResult> {
    if (!this.config.enabled) {
      return {
        didCompact: false,
        entriesCompacted: 0,
        tokensSaved: 0,
        tokensAfter: calculateContextUsage(entries).tokens,
      };
    }

    const cutPoint = this.findCutPoint(entries);
    if (cutPoint <= 0) {
      return {
        didCompact: false,
        entriesCompacted: 0,
        tokensSaved: 0,
        tokensAfter: calculateContextUsage(entries).tokens,
      };
    }

    const entriesToCompact = entries.slice(0, cutPoint);
    const entriesToKeep = entries.slice(cutPoint);
    const tokensBefore = calculateContextUsage(entries).tokens;

    // Try LLM summarization first, fallback to simple
    let summary: string;
    let usedLlm = false;

    if (this.llmConfig) {
      try {
        summary = await this.summarizeWithLLM(entriesToCompact, previousSummary);
        usedLlm = true;
      } catch (err) {
        console.warn("[Compaction] LLM summarization failed, using simple summary:", err);
        summary = this.generateSimpleSummary(entriesToCompact);
      }
    } else {
      summary = this.generateSimpleSummary(entriesToCompact);
    }

    const fileOps = extractFileOpsFromEntries(entriesToCompact);
    const { readFiles, modifiedFiles } = computeFileLists(fileOps);

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

    const newEntries = [compactionEntry, ...entriesToKeep];
    const tokensAfter = calculateContextUsage(newEntries).tokens;

    return {
      didCompact: true,
      entry: compactionEntry,
      entriesCompacted: entriesToCompact.length,
      tokensSaved: tokensBefore - tokensAfter,
      tokensAfter,
      usedLlm,
    };
  }

  /**
   * Generate summary using LLM
   */
  private async summarizeWithLLM(
    entries: SessionEntry[],
    previousSummary?: string
  ): Promise<string> {
    if (!this.llmConfig) {
      throw new Error("LLM config not set");
    }

    const { apiKey, model } = this.llmConfig;
    const conversationText = this.serializeEntries(entries);

    const basePrompt = previousSummary ? UPDATE_SUMMARIZATION_PROMPT : SUMMARIZATION_PROMPT;

    let promptText = `<conversation>\n${conversationText}\n</conversation>\n\n`;
    if (previousSummary) {
      promptText += `<previous-summary>\n${previousSummary}\n</previous-summary>\n\n`;
    }
    promptText += basePrompt;

    const maxTokens = Math.floor(0.8 * this.config.reserveTokens);

    const response = await completeSimple(model, {
      systemPrompt: SUMMARIZATION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: promptText }],
          timestamp: Date.now(),
        },
      ],
    }, { maxTokens, apiKey });

    if (response.stopReason === "error") {
      throw new Error(response.errorMessage || "LLM summarization failed");
    }

    const textContent = response.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    return textContent;
  }

  /**
   * Serialize entries to text for LLM
   */
  private serializeEntries(entries: SessionEntry[]): string {
    const lines: string[] = [];

    for (const entry of entries) {
      if (entry.type === "message") {
        const role = entry.message.role;
        const content = entry.message.content;
        const toolName = entry.message.toolName;
        const agentName = entry.message.agentName;

        if (role === "tool" && toolName) {
          lines.push(`[TOOL: ${toolName}] ${content}`);
        } else if (role === "user") {
          lines.push(`[USER] ${content}`);
        } else if (role === "assistant") {
          const prefix = agentName ? `[${agentName}] ` : "";
          lines.push(`[ASSISTANT] ${prefix}${content}`);
        }
      }
    }

    return lines.join("\n\n");
  }

  /**
   * Find the index where we should cut
   */
  private findCutPoint(entries: SessionEntry[]): number {
    let accumulatedTokens = 0;
    const budget = this.config.keepRecentTokens;

    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      const entryTokens = estimateEntryTokens(entry);

      if (this.isToolResult(entry) && i > 0) {
        const prevEntry = entries[i - 1];
        if (
          prevEntry?.type === "message" &&
          prevEntry?.message.role === "assistant" &&
          this.hasToolCallForResult(prevEntry, entry)
        ) {
          accumulatedTokens += entryTokens;
          if (accumulatedTokens > budget) {
            return i - 1;
          }
          continue;
        }
      }

      accumulatedTokens += entryTokens;

      if (accumulatedTokens > budget) {
        return i;
      }
    }

    return 0;
  }

  private isToolResult(entry: SessionEntry): boolean {
    return entry.type === "message" && entry.message.role === "tool";
  }

  private hasToolCallForResult(
    assistantEntry: SessionEntry,
    toolEntry: SessionEntry
  ): boolean {
    if (assistantEntry.type !== "message" || assistantEntry.message.role !== "assistant") return false;
    if (toolEntry.type !== "message" || toolEntry.message.role !== "tool") return false;
    if (toolEntry.message.toolName) {
      return true;
    }
    return false;
  }

  /**
   * Generate a simple summary without LLM
   */
  private generateSimpleSummary(entries: SessionEntry[]): string {
    const parts: string[] = [];

    const goals: string[] = [];
    const progress: string[] = [];

    for (const entry of entries) {
      if (entry.type === "message" && entry.message.role === "user") {
        const content = entry.message.content.trim();
        if (content.length < 200) {
          goals.push(content);
        }
      } else if (entry.type === "message" && entry.message.role === "assistant") {
        const content = entry.message.content.trim();
        if (content.length < 300) {
          progress.push(content.substring(0, 200));
        }
      }
    }

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

  /**
   * Generate summary - uses LLM if available, otherwise simple
   */
  private generateSummary(entries: SessionEntry[]): string {
    if (this.llmConfig) {
      // This is a sync method, so we fall back to simple summary
      // For LLM, use compactAsync()
      return this.generateSimpleSummary(entries);
    }
    return this.generateSimpleSummary(entries);
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

/**
 * Create a compaction engine with LLM config
 */
export async function createCompactionEngineWithLLM(
  apiKey: string,
  model: Model<any>
): Promise<CompactionEngine> {
  const { loadCompactionConfig } = await import("./config");
  const config = await loadCompactionConfig();
  return new CompactionEngine(config, { apiKey, model });
}
