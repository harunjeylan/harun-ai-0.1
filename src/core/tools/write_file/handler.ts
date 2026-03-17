import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ToolHandler } from "../../src/core/runtime/tools.js";

const InputSchema = z.object({
  path: z.string(),
  content: z.string(),
  overwrite: z.boolean().optional(),
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
  const rel = parsed.path.trim();
  if (!rel) throw new Error("path is required");

  const abs = resolveInCwd(rel);
  const overwrite = parsed.overwrite ?? true;

  if (!overwrite) {
    try {
      await stat(abs);
      throw new Error(`Refusing to overwrite existing file: ${rel}`);
    } catch {
      // ok (doesn't exist)
    }
  }

  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, parsed.content, "utf8");
  return { wrote: rel, bytes: Buffer.byteLength(parsed.content, "utf8") };
};

