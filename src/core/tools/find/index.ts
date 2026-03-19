/**
 * Find tool - Find files by glob pattern
 * Based on Pi's find.ts implementation
 */

import { glob } from "glob";
import path from "path";
import { resolvePath } from "../utils/path-utils";
import { truncateHead } from "../utils/truncate";

export const findDefination = {
  name: "find",
  description:
    "Find files by glob pattern. " +
    "Supports ** for recursive matching. " +
    "Respects .gitignore files.",
  inputSchema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Glob pattern to match files. Examples: '*.ts', '**/*.json', 'src/**/*.test.ts'",
      },
      path: {
        type: "string",
        description: "Directory to search in. Default: current directory",
      },
      limit: {
        type: "integer",
        description: "Maximum number of results. Default: 100",
        minimum: 1,
        maximum: 1000,
      },
    },
    required: ["pattern"],
  },
} as const;

export interface FindInput {
  pattern: string;
  path?: string;
  limit?: number;
}

export interface FindOutput {
  files: string[];
  totalFound: number;
  truncated?: boolean;
}

import type { ToolDeps } from "../../runtime/tools.js";

export async function toolHandler(
  input: FindInput,
  deps: ToolDeps
): Promise<FindOutput> {
  const searchPath = input.path
    ? resolvePath(input.path, deps.cwd)
    : deps.cwd || process.cwd();

  const limit = input.limit || 100;

  // Build glob pattern
  const pattern = path.join(searchPath, input.pattern);

  // Find files
  const files = await glob(pattern, {
    dot: true, // Include hidden files
    nodir: true, // Only files, not directories
    ignore: ["**/node_modules/**", "**/.git/**"],
  });

  // Sort alphabetically
  files.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const totalFound = files.length;

  // Make paths relative to search path
  const relativeFiles = files.map((f) => path.relative(searchPath, f));

  // Apply limit
  const limitedFiles = relativeFiles.slice(0, limit);
  const truncated = totalFound > limit;

  return {
    files: limitedFiles,
    totalFound,
    truncated,
  };
}
