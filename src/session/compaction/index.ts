/**
 * Context Compaction Module
 * Exports all compaction-related functionality
 */

export {
  estimateTokens,
  estimateEntryTokens,
  calculateContextUsage,
  needsCompaction,
  estimateCompactionSavings,
  type ContextUsage,
} from "./tokens";

export {
  loadCompactionConfig,
  saveGlobalCompactionConfig,
  getContextBudget,
  getCompactionThreshold,
  DEFAULT_COMPACTION_CONFIG,
  type CompactionConfig,
} from "./config";

export {
  createFileOperations,
  extractFileOpsFromEntry,
  extractFileOpsFromEntries,
  mergeFileOps,
  computeFileLists,
  serializeFileOps,
  deserializeFileOps,
  type FileOperations,
} from "./file-ops";

export {
  CompactionEngine,
  createCompactionEngine,
  createCompactionEngineWithLLM,
  type CompactionResult,
  type LLMConfig,
} from "./engine";

export {
  SUMMARIZATION_PROMPT,
  UPDATE_SUMMARIZATION_PROMPT,
  SUMMARIZATION_SYSTEM_PROMPT,
} from "./prompts";
