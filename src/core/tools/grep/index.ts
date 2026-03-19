/**
 * Grep tool - Search file contents with regex
 * Based on Pi's grep.ts implementation
 */

import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { resolvePath } from "../utils/path-utils";
import { truncateHead, truncateLongLines } from "../utils/truncate";

const execAsync = promisify(exec);

export const grepDefination = {
  name: "grep",
  description:
    "Search file contents using regex (via ripgrep). " +
    "Supports regex patterns, literal strings, context lines, and glob filtering.",
  inputSchema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Regex pattern to search for",
      },
      path: {
        type: "string",
        description: "Directory to search in. Default: current directory",
      },
      glob: {
        type: "string",
        description: "Glob pattern to filter files. Example: '*.ts'",
      },
      ignore_case: {
        type: "boolean",
        description: "Case insensitive search. Default: false",
      },
      literal: {
        type: "boolean",
        description: "Treat pattern as literal string, not regex. Default: false",
      },
      context: {
        type: "integer",
        description: "Number of context lines to show before/after matches. Default: 0",
        minimum: 0,
        maximum: 10,
      },
      limit: {
        type: "integer",
        description: "Maximum number of matches. Default: 100",
        minimum: 1,
        maximum: 500,
      },
    },
    required: ["pattern"],
  },
} as const;

export interface GrepInput {
  pattern: string;
  path?: string;
  glob?: string;
  ignore_case?: boolean;
  literal?: boolean;
  context?: number;
  limit?: number;
}

export interface GrepOutput {
  matches: Array<{
    file: string;
    line: number;
    column: number;
    match: string;
    context?: {
      before: string[];
      after: string[];
    };
  }>;
  totalMatches: number;
  truncated?: boolean;
}

import type { ToolDeps } from "../../runtime/tools.js";

export async function toolHandler(
  input: GrepInput,
  deps: ToolDeps
): Promise<GrepOutput> {
  const searchPath = input.path
    ? resolvePath(input.path, deps.cwd)
    : deps.cwd || process.cwd();

  const limit = input.limit || 100;

  // Build ripgrep command
  let cmd = "rg";

  // Add options
  if (input.ignore_case) {
    cmd += " -i";
  }

  if (input.literal) {
    cmd += " -F";
  }

  if (input.context && input.context > 0) {
    cmd += ` -C ${input.context}`;
  }

  // Add line numbers and column numbers
  cmd += " --line-number --column";

  // Add max count
  cmd += ` -m ${limit}`;

  // Add glob filter if provided
  if (input.glob) {
    cmd += ` -g "${input.glob}"`;
  }

  // Add pattern and path
  cmd += ` "${input.pattern.replace(/"/g, '\\"')}" "${searchPath}"`;

  try {
    const { stdout } = await execAsync(cmd, {
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    // Parse results
    const matches: GrepOutput["matches"] = [];
    const lines = stdout.split("\n").filter(Boolean);

    for (const line of lines) {
      // Parse format: file:line:column:match
      const match = line.match(/^(.+):(\d+):(\d+):(.*)$/);
      if (match) {
        const [, file, lineNum, col, text] = match;
        matches.push({
          file: path.relative(searchPath, file),
          line: parseInt(lineNum, 10),
          column: parseInt(col, 10),
          match: text,
        });
      }
    }

    // Truncate long lines
    const truncatedMatches = matches.map((m) => {
      const truncated = truncateLongLines(m.match);
      return { ...m, match: truncated.content };
    });

    return {
      matches: truncatedMatches,
      totalMatches: truncatedMatches.length,
      truncated: matches.length >= limit,
    };
  } catch (error: any) {
    // No matches or error
    if (error.code === 1) {
      // ripgrep returns 1 when no matches found
      return {
        matches: [],
        totalMatches: 0,
      };
    }

    throw new Error(`Grep failed: ${error.message}`);
  }
}
