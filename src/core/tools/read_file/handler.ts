import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ToolHandler } from "../../src/core/runtime/tools.js";

const InputSchema = z.object({
  path: z.string(),
  startLine: z.number().int().min(1).optional(),
  endLine: z.number().int().min(1).optional(),
  maxBytes: z.number().int().min(1).max(2_000_000).optional(),
});

function resolveInCwd(p: string): string {
  const abs = path.resolve(process.cwd(), p);
  const cwd = path.resolve(process.cwd());
  if (abs !== cwd && !abs.startsWith(cwd + path.sep)) {
    throw new Error(`Path escapes cwd: ${p}`);
  }
  return abs;
}

export const toolHandler: ToolHandler = async (input) => {
  const parsed = InputSchema.parse(input ?? {});
  const abs = resolveInCwd(parsed.path.trim());
  const maxBytes = parsed.maxBytes ?? 200_000;

  const buf = await readFile(abs);
  const sliced = buf.length > maxBytes ? buf.subarray(0, maxBytes) : buf;
  const text = sliced.toString("utf8");

  const startLine = parsed.startLine;
  const endLine = parsed.endLine;
  if (!startLine && !endLine) {
    return {
      path: parsed.path,
      truncated: buf.length > maxBytes,
      content: text,
    };
  }

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const s = Math.max(1, startLine ?? 1);
  const e = Math.max(s, endLine ?? lines.length);
  const slice = lines.slice(s - 1, e).join("\n");
  return {
    path: parsed.path,
    truncated: buf.length > maxBytes,
    startLine: s,
    endLine: e,
    content: slice,
  };
};

