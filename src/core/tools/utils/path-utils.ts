/**
 * Path utilities for cross-platform path handling
 * Includes macOS-specific filename normalization
 */

import { homedir } from "os";
import path from "path";

/**
 * Expand ~ to home directory
 */
export function expandHome(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return path.join(homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Normalize path separators to forward slashes
 */
export function normalizeSeparators(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

/**
 * macOS-specific filename normalization
 * Handles:
 * - NFD normalization (macOS filename encoding)
 * - Curly quote normalization (French screenshots)
 * - Smart quote normalization
 * - Narrow no-break space (AM/PM in screenshots)
 */
export function normalizeMacFilename(filename: string): string {
  // NFD to NFC normalization (macOS uses NFD for filenames)
  let normalized = filename.normalize("NFC");

  // Replace narrow no-break space with regular space
  // Used in AM/PM on macOS screenshots
  normalized = normalized.replace(/\u202f/g, " ");

  // Replace smart quotes with ASCII quotes
  normalized = normalized
    .replace(/[\u2018\u2019]/g, "'") // Left/right single quotes
    .replace(/[\u201c\u201d]/g, '"') // Left/right double quotes
    .replace(/[\u201a\u201e]/g, ",") // Low quotes
    .replace(/\u2013/g, "-") // En dash
    .replace(/\u2014/g, "-") // Em dash
    .replace(/[\u00a0\u2000-\u200a\u202f\u205f]/g, " "); // Various spaces

  return normalized;
}

/**
 * Resolve a user-provided path to absolute path
 * Handles: ~ expansion, relative paths, normalization
 */
export function resolvePath(
  userPath: string,
  cwd: string = process.cwd()
): string {
  // Expand ~
  let resolved = expandHome(userPath);

  // Normalize macOS filenames
  resolved = normalizeMacFilename(resolved);

  // If relative, resolve against cwd
  if (!path.isAbsolute(resolved)) {
    resolved = path.join(cwd, resolved);
  }

  // Normalize the path
  return path.normalize(resolved);
}

/**
 * Check if path is inside workspace
 * For security, tools should generally stay within workspace
 */
export function isInsideWorkspace(
  filePath: string,
  workspaceRoot: string = process.cwd()
): boolean {
  const resolved = path.resolve(filePath);
  const root = path.resolve(workspaceRoot);
  return resolved.startsWith(root);
}

/**
 * Get relative path from workspace root
 */
export function getRelativePath(
  filePath: string,
  workspaceRoot: string = process.cwd()
): string {
  return path.relative(workspaceRoot, filePath);
}
