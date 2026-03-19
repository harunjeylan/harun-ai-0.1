/**
 * Hierarchical Settings Manager for HarunAI
 * 
 * Load order (later wins):
 * 1. ./config/           - Application defaults (git-tracked)
 * 2. ~/.harunai/        - User global overrides
 * 3. ./.harunai/        - Project-specific overrides
 * 
 * Usage:
 *   import { loadSettings, saveSettings, getSetting } from "./settings";
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { z } from "zod";
import { deepMerge, deepMergeAll, getNestedValue, setNestedValue } from "./merge.js";
import {
  APP_CONFIG_DIR,
  GLOBAL_CONFIG_DIR,
  PROJECT_CONFIG_DIR,
  CONFIG_SUBDIRS,
  isConfigSubdir,
  getConfigPaths,
  type ConfigSubdir,
} from "./paths.js";
import {
  DEFAULT_SETTINGS,
  type HarunAISettings,
  type ModelSettings,
  type UISettings,
  type CompactionSettings,
  type KeybindingSettings,
} from "./types.js";

const SETTINGS_FILENAME = "settings.json";

const HarunAISettingsSchema = z.object({
  model: z
    .object({
      provider: z.string().optional(),
      modelId: z.string().optional(),
    })
    .optional(),
  ui: z
    .object({
      theme: z.enum(["dark", "light"]).optional(),
      showThinking: z.boolean().optional(),
      streaming: z.boolean().optional(),
    })
    .optional(),
  compaction: z
    .object({
      enabled: z.boolean().optional(),
      contextWindow: z.number().optional(),
      reserveTokens: z.number().optional(),
      keepRecentTokens: z.number().optional(),
      triggerThreshold: z.number().optional(),
      verbose: z.boolean().optional(),
    })
    .optional(),
  keybindings: z.record(z.string()).optional(),
});

type CachedSettings = {
  settings: HarunAISettings;
  loaded: boolean;
};

const settingsCache: CachedSettings = {
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,
};

/**
 * Load and cache settings from all hierarchical sources
 */
export async function loadSettings(): Promise<HarunAISettings> {
  if (settingsCache.loaded) {
    return settingsCache.settings;
  }

  let merged: Record<string, unknown> = {};

  // 1. Load from ./config/settings.json (defaults)
  const defaultPath = join(APP_CONFIG_DIR, SETTINGS_FILENAME);
  if (existsSync(defaultPath)) {
    try {
      const content = readFileSync(defaultPath, "utf-8");
      const parsed = JSON.parse(content);
      merged = deepMerge(merged, parsed);
    } catch (err) {
      console.warn("[Settings] Failed to load default settings:", err);
    }
  }

  // 2. Load from ~/.harunai/settings.json (global overrides)
  const globalPath = join(GLOBAL_CONFIG_DIR, SETTINGS_FILENAME);
  if (existsSync(globalPath)) {
    try {
      const content = readFileSync(globalPath, "utf-8");
      const parsed = JSON.parse(content);
      merged = deepMerge(merged, parsed);
    } catch (err) {
      console.warn("[Settings] Failed to load global settings:", err);
    }
  }

  // 3. Load from ./.harunai/settings.json (project overrides)
  const projectPath = join(PROJECT_CONFIG_DIR, SETTINGS_FILENAME);
  if (existsSync(projectPath)) {
    try {
      const content = readFileSync(projectPath, "utf-8");
      const parsed = JSON.parse(content);
      merged = deepMerge(merged, parsed);
    } catch (err) {
      console.warn("[Settings] Failed to load project settings:", err);
    }
  }

  // Validate and apply defaults for missing keys
  const validated = HarunAISettingsSchema.safeParse(merged);
  if (validated.success) {
    settingsCache.settings = deepMergeAll(DEFAULT_SETTINGS, merged as HarunAISettings);
  } else {
    console.warn("[Settings] Invalid settings schema, using defaults");
    settingsCache.settings = { ...DEFAULT_SETTINGS };
  }

  settingsCache.loaded = true;
  return settingsCache.settings;
}

/**
 * Save settings to global config (~/.harunai/settings.json)
 */
export async function saveSettings(
  settings: Partial<HarunAISettings>,
  location: "global" | "project" = "global"
): Promise<void> {
  const baseDir = location === "global" ? GLOBAL_CONFIG_DIR : PROJECT_CONFIG_DIR;
  const settingsPath = join(baseDir, SETTINGS_FILENAME);

  // Load existing settings
  let existing: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try {
      const content = readFileSync(settingsPath, "utf-8");
      existing = JSON.parse(content);
    } catch {
      // Ignore parse errors
    }
  }

  // Merge new settings
  const merged = deepMerge(existing, settings);

  // Ensure directory exists
  try {
    mkdirSync(dirname(settingsPath), { recursive: true });
  } catch {
    // Ignore if already exists
  }

  // Write settings
  writeFileSync(settingsPath, JSON.stringify(merged, null, 2), "utf-8");

  // Invalidate cache
  settingsCache.loaded = false;
}

/**
 * Get a specific setting value using dot notation
 */
export function getSetting<T = unknown>(
  settings: HarunAISettings,
  path: string,
  defaultValue?: T
): T | undefined {
  return getNestedValue(settings as Record<string, unknown>, path, defaultValue);
}

/**
 * Update a specific setting and save
 */
export async function setSetting(
  path: string,
  value: unknown,
  location: "global" | "project" = "global"
): Promise<void> {
  const settings = await loadSettings();
  setNestedValue(settings as Record<string, unknown>, path, value);
  await saveSettings(settings as HarunAISettings, location);
}

/**
 * Load a config file hierarchically
 * Returns the first found file, in order: project, global, default
 */
export function loadConfigFile<T>(
  subdir: string,
  filename: string,
  parser: (content: string) => T = JSON.parse
): T | null {
  const paths = getConfigPaths(subdir, filename);

  for (const { path, location } of paths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, "utf-8");
        return parser(content);
      } catch (err) {
        console.warn(`[Settings] Failed to load ${path}:`, err);
      }
    }
  }

  return null;
}

/**
 * Load all config files from a subdir across all hierarchical levels
 * Returns merged content (later levels override earlier)
 */
export function loadAllConfigFiles<T extends Record<string, unknown>>(
  subdir: string,
  options?: {
    extension?: string;
    parser?: (content: string, filename: string) => T;
    mergeArrays?: boolean;
  }
): T[] {
  const results: T[] = [];
  const extension = options?.extension ?? ".json";

  for (const location of ["default", "global", "project"] as const) {
    const baseDir =
      location === "default"
        ? APP_CONFIG_DIR
        : location === "global"
          ? GLOBAL_CONFIG_DIR
          : PROJECT_CONFIG_DIR;

    const dirPath = join(baseDir, subdir);

    if (!existsSync(dirPath)) continue;

    try {
      const files = readdirSync(dirPath);

      for (const file of files) {
        if (!file.endsWith(extension)) continue;

        const filePath = join(dirPath, file);
        try {
          const content = readFileSync(filePath, "utf-8");
          const parsed = options?.parser
            ? options.parser(content, file)
            : JSON.parse(content);
          results.push(parsed);
        } catch (err) {
          console.warn(`[Settings] Failed to load ${filePath}:`, err);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
  }

  return results;
}

/**
 * Get list of all config files in a subdir from all locations
 * Returns path, location, and whether file exists
 */
export function listConfigFiles(
  subdir: string,
  extension: string = ".json"
): Array<{ path: string; location: "default" | "global" | "project"; filename: string }> {
  const results: Array<{
    path: string;
    location: "default" | "global" | "project";
    filename: string;
  }> = [];

  for (const location of ["default", "global", "project"] as const) {
    const baseDir =
      location === "default"
        ? APP_CONFIG_DIR
        : location === "global"
          ? GLOBAL_CONFIG_DIR
          : PROJECT_CONFIG_DIR;

    const dirPath = join(baseDir, subdir);

    if (!existsSync(dirPath)) continue;

    try {
      const files = readdirSync(dirPath);

      for (const file of files) {
        if (!file.endsWith(extension)) continue;
        results.push({
          path: join(dirPath, file),
          location,
          filename: file,
        });
      }
    } catch {
      // Ignore
    }
  }

  return results;
}

/**
 * Ensure global config directory exists
 */
export function ensureGlobalConfigDir(): void {
  mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
}

/**
 * Get the global config directory path
 */
export function getGlobalConfigDir(): string {
  return GLOBAL_CONFIG_DIR;
}

/**
 * Check if running in a project with .harunai/ directory
 */
export function hasProjectConfig(): boolean {
  return existsSync(join(PROJECT_CONFIG_DIR, SETTINGS_FILENAME));
}

// Re-export types
export type {
  HarunAISettings,
  ModelSettings,
  UISettings,
  CompactionSettings,
  KeybindingSettings,
};
