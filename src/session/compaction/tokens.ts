/**
 * Token estimation utilities for context compaction
 * Uses conservative heuristics to estimate token counts
 */

import type { SessionEntry } from "../types";

// Conservative heuristic: ~4 characters per token
const CHARS_PER_TOKEN = 4;

// Image token estimation (varies by model, use conservative estimate)
const IMAGE_TOKEN_ESTIMATE = 1200;

/**
 * Estimate tokens for plain text
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens for a session entry
 */
export function estimateEntryTokens(entry: SessionEntry): number {
  let tokens = 0;

  // Base tokens for message structure
  tokens += 4;

  switch (entry.type) {
    case "message": {
      const msg = entry.message;
      tokens += estimateTokens(msg.content);

      // Tool name if present
      if (msg.toolName) {
        tokens += estimateTokens(msg.toolName);
      }

      // Agent name if present
      if (msg.agentName) {
        tokens += estimateTokens(msg.agentName);
      }
      break;
    }

    case "compaction":
      // Compaction summaries count too
      tokens += estimateTokens(entry.content);
      break;

    case "custom_message":
      tokens += estimateTokens(entry.content);
      break;

    case "branch_summary":
      tokens += estimateTokens(entry.content);
      break;

    case "thinking_level_change":
      tokens += 4; // Just the level change
      break;

    case "model_change":
      tokens += estimateTokens(entry.provider);
      tokens += estimateTokens(entry.modelId);
      break;

    case "custom":
      // Custom entries don't go to LLM, minimal tokens
      tokens += 2;
      break;

    case "label":
      // Labels don't go to LLM
      tokens += 0;
      break;

    case "session_info":
      // Session info doesn't go to LLM
      tokens += 0;
      break;

    default:
      // Unknown type, estimate based on any content property
      const content = (entry as { content?: string }).content;
      if (content) {
        tokens += estimateTokens(content);
      }
  }

  return tokens;
}

/**
 * Calculate total context usage for a session
 */
export function calculateContextUsage(
  entries: SessionEntry[],
  systemPrompt?: string
): ContextUsage {
  let totalTokens = 0;

  // System prompt tokens
  if (systemPrompt) {
    totalTokens += estimateTokens(systemPrompt);
  }

  // Entry tokens
  for (const entry of entries) {
    totalTokens += estimateEntryTokens(entry);
  }

  return {
    tokens: totalTokens,
    entryCount: entries.length,
  };
}

/**
 * Context usage information
 */
export interface ContextUsage {
  tokens: number;
  entryCount: number;
}

/**
 * Check if context needs compaction
 */
export function needsCompaction(
  usage: ContextUsage,
  windowSize: number,
  threshold: number = 0.8
): boolean {
  return usage.tokens > windowSize * threshold;
}

/**
 * Calculate how many tokens would be saved by compacting
 */
export function estimateCompactionSavings(
  entriesToCompact: SessionEntry[],
  summaryEntryTokens: number = 500
): number {
  const currentTokens = entriesToCompact.reduce(
    (sum, entry) => sum + estimateEntryTokens(entry),
    0
  );
  return currentTokens - summaryEntryTokens;
}
