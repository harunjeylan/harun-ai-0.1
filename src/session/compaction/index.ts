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
  type CompactionResult,
} from "./engine";
