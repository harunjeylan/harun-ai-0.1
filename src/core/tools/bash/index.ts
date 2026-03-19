/**
 * Bash tool - Execute shell commands
 * Based on Pi's bash.ts implementation
 */

import { exec } from "child_process";
import { promisify } from "util";
import { truncateTail } from "../utils/truncate";

const execAsync = promisify(exec);

export const bashDefination = {
  name: "bash",
  description:
    "Execute a bash command. " +
    "Runs in the current working directory. " +
    "Use timeout parameter for long-running commands.",
  inputSchema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The bash command to execute.",
      },
      timeout: {
        type: "integer",
        description: "Timeout in seconds. Default: 60",
        minimum: 1,
        maximum: 300,
      },
    },
    required: ["command"],
  },
} as const;

export interface BashInput {
  command: string;
  timeout?: number;
}

export interface BashOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  truncated?: boolean;
}

import type { ToolDeps } from "../../runtime/tools.js";

export async function toolHandler(
  input: BashInput,
  deps: ToolDeps,
): Promise<BashOutput> {
  const cwd = deps.cwd || process.cwd();
  const timeoutMs = (input.timeout || 60) * 1000;

  try {
    const { stdout, stderr } = await execAsync(input.command, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
    });

    // Truncate output if needed
    const truncatedStdout = truncateTail(stdout || "");
    const truncatedStderr = truncateTail(stderr || "");

    return {
      stdout: truncatedStdout.content,
      stderr: truncatedStderr.content,
      exitCode: 0,
      truncated: truncatedStdout.wasTruncated || truncatedStderr.wasTruncated,
    };
  } catch (error: any) {
    // Command failed or timed out
    const stdout = error.stdout || "";
    const stderr = error.stderr || "";

    // Truncate output
    const truncatedStdout = truncateTail(stdout);
    const truncatedStderr = truncateTail(stderr);

    return {
      stdout: truncatedStdout.content,
      stderr: truncatedStderr.content,
      exitCode: error.code || 1,
      truncated: truncatedStdout.wasTruncated || truncatedStderr.wasTruncated,
    };
  }
}
