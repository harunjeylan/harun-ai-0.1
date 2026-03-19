/**
 * Path constants for hierarchical config system
 * 
 * Load order (later wins):
 * 1. ./config/           - Application defaults (git-tracked)
 * 2. ~/.harunai/        - User global overrides
 * 3. ./.harunai/        - Project-specific overrides
 */

import { homedir } from "os";
import { join, isAbsolute, resolve } from "path";

export const APP_CONFIG_DIR = "config";
export const GLOBAL_CONFIG_DIR = join(homedir(), ".harunai");
export const PROJECT_CONFIG_DIR = ".harunai";

export const CONFIG_SUBDIRS = [
  "agents",
  "workflows",
  "providers",
  "tools",
  "templates",
  "skills",
  "rules",
] as const;

export type ConfigSubdir = typeof CONFIG_SUBDIRS[number];

export function isConfigSubdir(name: string): name is ConfigSubdir {
  return (CONFIG_SUBDIRS as readonly string[]).includes(name);
}

/**
 * Get absolute path for a config location
 */
export function getConfigPath(
  subdir: string,
  filename: string,
  location: "default" | "global" | "project"
): string | null {
  let baseDir: string;

  switch (location) {
    case "default":
      baseDir = APP_CONFIG_DIR;
      break;
    case "global":
      baseDir = GLOBAL_CONFIG_DIR;
      break;
    case "project":
      baseDir = PROJECT_CONFIG_DIR;
      break;
  }

  return join(baseDir, subdir, filename);
}

/**
 * Get all possible paths for a config file, in load order
 */
export function getConfigPaths(
  subdir: string,
  filename: string
): Array<{ path: string; location: "default" | "global" | "project" }> {
  const paths: Array<{ path: string; location: "default" | "global" | "project" }> = [];

  // Default first (lowest priority)
  const defaultPath = getConfigPath(subdir, filename, "default");
  if (defaultPath) paths.push({ path: defaultPath, location: "default" });

  // Global second
  const globalPath = getConfigPath(subdir, filename, "global");
  if (globalPath) paths.push({ path: globalPath, location: "global" });

  // Project last (highest priority)
  const projectPath = getConfigPath(subdir, filename, "project");
  if (projectPath) paths.push({ path: projectPath, location: "project" });

  return paths;
}

/**
 * Get directory paths for a subdir across all locations
 */
export function getConfigDirPaths(
  subdir: string
): Array<{ path: string; location: "default" | "global" | "project"; exists: boolean }> {
  const baseDirs = [
    { dir: APP_CONFIG_DIR, location: "default" as const },
    { dir: GLOBAL_CONFIG_DIR, location: "global" as const },
    { dir: PROJECT_CONFIG_DIR, location: "project" as const },
  ];

  return baseDirs.map(({ dir, location }) => ({
    path: join(dir, subdir),
    location,
    exists: false, // Will be set by caller
  }));
}
