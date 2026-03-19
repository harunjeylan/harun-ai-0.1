/**
 * Write tool - Write/create files with directory creation
 * Based on Pi's write.ts implementation
 */

import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { resolvePath } from "../utils/path-utils";

export const writeDefination = {
  name: "write",
  description:
    "Write content to a file. Creates the file if it doesn't exist, " +
    "overwrites if it does. Creates parent directories automatically.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Path to the file (relative or absolute). Supports ~ for home directory.",
      },
      content: {
        type: "string",
        description: "Content to write to the file.",
      },
    },
    required: ["path", "content"],
  },
} as const;

export interface WriteInput {
  path: string;
  content: string;
}

export interface WriteOutput {
  success: boolean;
  bytesWritten: number;
  path: string;
}

import type { ToolDeps } from "../../runtime/tools.js";

export async function toolHandler(
  input: WriteInput,
  deps: ToolDeps,
): Promise<WriteOutput> {
  const resolvedPath = resolvePath(input.path, deps.cwd);
  console.log(resolvedPath);

  // Create parent directories if needed
  const parentDir = path.dirname(resolvedPath);
  await mkdir(parentDir, { recursive: true });

  // Write file
  const buffer = Buffer.from(input.content, "utf-8");
  await writeFile(resolvedPath, buffer);

  return {
    success: true,
    bytesWritten: buffer.length,
    path: resolvedPath,
  };
}
