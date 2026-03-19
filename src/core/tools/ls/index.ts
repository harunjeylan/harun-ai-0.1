/**
 * Ls tool - List directory contents
 * Based on Pi's ls.ts implementation
 */

import { readdir, stat } from "fs/promises";
import path from "path";
import { resolvePath } from "../utils/path-utils";
import { truncateHead } from "../utils/truncate";

export const lsDefination = {
  name: "ls",
  description:
    "List files and directories. " +
    "Returns entries sorted alphabetically with directory indicators.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Directory path. Default: current directory",
      },
      limit: {
        type: "integer",
        description: "Maximum number of entries. Default: 500",
        minimum: 1,
        maximum: 1000,
      },
    },
  },
} as const;

export interface LsInput {
  path?: string;
  limit?: number;
}

export interface LsOutput {
  entries: Array<{
    name: string;
    type: "file" | "directory" | "other";
    indicator: string;
  }>;
  totalEntries: number;
  truncated?: boolean;
}

import type { ToolDeps } from "../../runtime/tools.js";

export async function toolHandler(
  input: LsInput,
  deps: ToolDeps
): Promise<LsOutput> {
  const dirPath = input.path
    ? resolvePath(input.path, deps.cwd)
    : deps.cwd || process.cwd();

  const limit = input.limit || 500;

  // Read directory
  const entries = await readdir(dirPath, { withFileTypes: true });

  // Sort alphabetically (case-insensitive)
  entries.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  const totalEntries = entries.length;

  // Format entries
  const formattedEntries = entries.map((entry) => {
    let type: "file" | "directory" | "other";
    let indicator = "";

    if (entry.isDirectory()) {
      type = "directory";
      indicator = "/";
    } else if (entry.isFile()) {
      type = "file";
      indicator = "";
    } else {
      type = "other";
      indicator = "@"; // Symlink or special
    }

    return {
      name: entry.name,
      type,
      indicator,
    };
  });

  // Apply limit
  const limitedEntries = formattedEntries.slice(0, limit);
  const truncated = totalEntries > limit;

  return {
    entries: limitedEntries,
    totalEntries,
    truncated,
  };
}
