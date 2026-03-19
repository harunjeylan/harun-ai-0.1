/**
 * Edit tool - Precise text replacement with fuzzy matching
 * Based on Pi's edit.ts implementation
 */

import { readFile, writeFile, access } from "fs/promises";
import { constants } from "fs";
import { resolvePath } from "../utils/path-utils";

export const editDefination = {
  name: "edit",
  description:
    "Make precise text replacements in files. " +
    "Uses exact string matching with fuzzy fallback. " +
    "Fails if the old_text is not found or if multiple occurrences are found.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file (relative or absolute). Supports ~ for home directory.",
      },
      old_text: {
        type: "string",
        description: "Text to search for. Must match exactly (or close with fuzzy matching).",
      },
      new_text: {
        type: "string",
        description: "Text to replace with.",
      },
    },
    required: ["path", "old_text", "new_text"],
  },
} as const;

export interface EditInput {
  path: string;
  old_text: string;
  new_text: string;
}

export interface EditOutput {
  success: boolean;
  path: string;
  diff?: string;
  error?: string;
}

/**
 * Normalize text for fuzzy matching
 * Applies transformations to make matching more forgiving
 */
function normalizeForMatching(text: string): string {
  return (
    text
      // Strip trailing whitespace per line
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      // Normalize smart quotes to ASCII
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      // Normalize Unicode dashes to hyphen
      .replace(/[\u2013\u2014]/g, "-")
      // Normalize special spaces to regular space
      .replace(/[\u00a0\u2000-\u200a\u202f\u205f]/g, " ")
      // Trim overall
      .trim()
  );
}

/**
 * Find all occurrences of a pattern in content
 */
function findAllOccurrences(content: string, pattern: string): number[] {
  const indices: number[] = [];
  let pos = 0;

  while ((pos = content.indexOf(pattern, pos)) !== -1) {
    indices.push(pos);
    pos += 1; // Move forward to find overlapping matches
  }

  return indices;
}

/**
 * Generate unified diff
 */
function generateDiff(
  oldContent: string,
  newContent: string,
  path: string
): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  // Simple line-by-line diff
  let diff = `--- ${path}\n+++ ${path}\n`;

  // Find first changed line
  let startLine = 0;
  while (
    startLine < oldLines.length &&
    startLine < newLines.length &&
    oldLines[startLine] === newLines[startLine]
  ) {
    startLine++;
  }

  // Show context (3 lines before)
  const contextStart = Math.max(0, startLine - 3);
  for (let i = contextStart; i < startLine && i < oldLines.length; i++) {
    diff += ` ${oldLines[i]}\n`;
  }

  // Show removed lines
  for (let i = startLine; i < oldLines.length; i++) {
    diff += `-${oldLines[i]}\n`;
  }

  // Show added lines
  for (let i = startLine; i < newLines.length; i++) {
    diff += `+${newLines[i]}\n`;
  }

  return diff;
}

import type { ToolDeps } from "../../runtime/tools.js";

export async function toolHandler(
  input: EditInput,
  deps: ToolDeps
): Promise<EditOutput> {
  const resolvedPath = resolvePath(input.path, deps.cwd);

  // Check if file exists
  try {
    await access(resolvedPath, constants.R_OK | constants.W_OK);
  } catch {
    return {
      success: false,
      path: resolvedPath,
      error: `File not found or not writable: ${input.path}`,
    };
  }

  // Read file
  const originalContent = await readFile(resolvedPath, "utf-8");

  // Try exact match first
  let occurrences = findAllOccurrences(originalContent, input.old_text);

  // If not found, try fuzzy matching
  if (occurrences.length === 0) {
    const normalizedOld = normalizeForMatching(input.old_text);
    const normalizedContent = normalizeForMatching(originalContent);

    // Find in normalized content
    const normalizedPos = normalizedContent.indexOf(normalizedOld);
    if (normalizedPos !== -1) {
      // Map back to original position (approximate)
      // For simplicity, we'll search for a unique substring
      const uniquePart = normalizedOld.substring(0, Math.min(50, normalizedOld.length));
      const fuzzyOccurrences = findAllOccurrences(originalContent, uniquePart);

      if (fuzzyOccurrences.length === 1) {
        occurrences = fuzzyOccurrences;
      }
    }
  }

  // Check results
  if (occurrences.length === 0) {
    return {
      success: false,
      path: resolvedPath,
      error: `Could not find text to replace in ${input.path}. The old_text was not found.`,
    };
  }

  if (occurrences.length > 1) {
    return {
      success: false,
      path: resolvedPath,
      error: `Found ${occurrences.length} occurrences of the text in ${input.path}. ` +
        `Edit requires a unique match. Please provide more context to make the match unique.`,
    };
  }

  // Perform replacement
  const position = occurrences[0];
  const newContent =
    originalContent.substring(0, position) +
    input.new_text +
    originalContent.substring(position + input.old_text.length);

  // Generate diff
  const diff = generateDiff(originalContent, newContent, input.path);

  // Write file
  await writeFile(resolvedPath, newContent, "utf-8");

  return {
    success: true,
    path: resolvedPath,
    diff,
  };
}
