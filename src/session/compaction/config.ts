/**
 * Compaction configuration management
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

const GLOBAL_CONFIG_PATH = join(homedir(), ".harunai", "settings.json");
const PROJECT_CONFIG_PATH = join(process.cwd(), ".harunai", "settings.json");

/**
 * Compaction configuration options
 */
export interface CompactionConfig {
  /** Enable/disable auto-compaction */
  enabled: boolean;
  /** Context window size (default: 8192) */
  contextWindow: number;
  /** Tokens to reserve for response (default: 2048) */
  reserveTokens: number;
  /** Tokens to keep recent (not compacted) (default: 4000) */
  keepRecentTokens: number;
  /** Trigger threshold (0-1, default: 0.75) */
  triggerThreshold: number;
  /** Enable verbose compaction notifications */
  verbose: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
  enabled: true,
  contextWindow: 8192,
  reserveTokens: 2048,
  keepRecentTokens: 4000,
  triggerThreshold: 0.75,
  verbose: false,
};

/**
 * Load compaction configuration from settings files
 * Merges global and project settings, with project taking precedence
 */
export async function loadCompactionConfig(): Promise<CompactionConfig> {
  const config = { ...DEFAULT_COMPACTION_CONFIG };

  // Load global config
  try {
    if (existsSync(GLOBAL_CONFIG_PATH)) {
      const content = await readFile(GLOBAL_CONFIG_PATH, "utf-8");
      const settings = JSON.parse(content);
      if (settings.compaction) {
        Object.assign(config, settings.compaction);
      }
    }
  } catch (err) {
    console.warn("[Compaction] Failed to load global config:", err);
  }

  // Load project config (overrides global)
  try {
    if (existsSync(PROJECT_CONFIG_PATH)) {
      const content = await readFile(PROJECT_CONFIG_PATH, "utf-8");
      const settings = JSON.parse(content);
      if (settings.compaction) {
        Object.assign(config, settings.compaction);
      }
    }
  } catch (err) {
    console.warn("[Compaction] Failed to load project config:", err);
  }

  return config;
}

/**
 * Save compaction configuration to global settings
 */
export async function saveGlobalCompactionConfig(
  config: Partial<CompactionConfig>
): Promise<void> {
  try {
    let settings: Record<string, unknown> = {};

    // Load existing settings
    if (existsSync(GLOBAL_CONFIG_PATH)) {
      const content = await readFile(GLOBAL_CONFIG_PATH, "utf-8");
      settings = JSON.parse(content);
    }

    // Merge compaction config
    settings.compaction = {
      ...(settings.compaction as Record<string, unknown> || {}),
      ...config,
    };

    // Ensure directory exists
    await mkdir(dirname(GLOBAL_CONFIG_PATH), { recursive: true });

    // Save
    await writeFile(GLOBAL_CONFIG_PATH, JSON.stringify(settings, null, 2), "utf-8");
  } catch (err) {
    console.error("[Compaction] Failed to save config:", err);
    throw err;
  }
}

/**
 * Calculate effective context budget (window - reserve)
 */
export function getContextBudget(config: CompactionConfig): number {
  return config.contextWindow - config.reserveTokens;
}

/**
 * Calculate compaction threshold in tokens
 */
export function getCompactionThreshold(config: CompactionConfig): number {
  return Math.floor(config.contextWindow * config.triggerThreshold);
}
