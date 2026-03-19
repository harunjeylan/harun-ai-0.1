/**
 * Read tool - Read text files with pagination and optional image support
 * Based on Pi's read.ts implementation
 */

import { constants } from "fs";
import { access, readFile } from "fs/promises";
import path from "path";
import { resolvePath } from "../utils/path-utils";
import { truncateHead } from "../utils/truncate";

export const readDefination = {
  name: "read",
  description:
    "Read a text file and optionally view an image. " +
    "Use offset and limit parameters to read specific portions of large files. " +
    "Supports images: jpg, jpeg, png, gif, webp.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Path to the file (relative or absolute). Supports ~ for home directory.",
      },
      offset: {
        type: "integer",
        description:
          "Line number to start reading from (1-indexed). Default: 1",
        minimum: 1,
      },
      limit: {
        type: "integer",
        description:
          "Maximum number of lines to read. Default: reads all lines",
        minimum: 1,
      },
    },
    required: ["path"],
  },
} as const;

export interface ReadInput {
  path: string;
  offset?: number;
  limit?: number;
}

export interface ReadOutput {
  content: string;
  totalLines?: number;
  truncated?: boolean;
  isImage?: boolean;
  mimeType?: string;
  imageData?: string; // base64
}

// Image MIME types
const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
]);

function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".bmp":
      return "image/bmp";
    default:
      return "application/octet-stream";
  }
}

import type { ToolDeps } from "../../runtime/tools.js";

export async function toolHandler(
  input: ReadInput,
  deps: ToolDeps,
): Promise<ReadOutput> {
  const resolvedPath = resolvePath(input.path, deps.cwd);

  // Check if file exists and is readable
  try {
    await access(resolvedPath, constants.R_OK);
  } catch {
    throw new Error(`File not found or not readable: ${input.path}`);
  }

  // Handle image files
  if (isImageFile(resolvedPath)) {
    const buffer = await readFile(resolvedPath);
    const base64 = buffer.toString("base64");

    return {
      content: `[Image: ${path.basename(resolvedPath)}]`,
      isImage: true,
      mimeType: getMimeType(resolvedPath),
      imageData: base64,
    };
  }

  // Read text file
  const content = await readFile(resolvedPath, "utf-8");
  const lines = content.split("\n");
  const totalLines = lines.length;

  // Apply offset and limit
  const offset = (input.offset ?? 1) - 1; // Convert to 0-indexed
  const limit = input.limit;

  let processedContent: string;
  let startLine = offset;
  let endLine = limit ? Math.min(offset + limit, totalLines) : totalLines;

  if (offset > 0 || limit) {
    processedContent = lines.slice(startLine, endLine).join("\n");
  } else {
    processedContent = content;
  }

  // Apply truncation if needed
  const truncated = truncateHead(processedContent);

  // Build result with line information
  const result: ReadOutput = {
    content: truncated.content,
    totalLines,
    truncated: truncated.wasTruncated,
  };

  // Add continuation hint if truncated
  if (truncated.wasTruncated && truncated.continuationHint) {
    result.content += "\n\n" + truncated.continuationHint;
  }

  // Add line range info if offset or limit was used
  if (offset > 0 || limit) {
    const actualEndLine = endLine;
    result.content = `[Lines ${startLine + 1}-${actualEndLine} of ${totalLines}]\n\n${result.content}`;
  }

  return result;
}
