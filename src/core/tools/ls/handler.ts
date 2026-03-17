import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ToolHandler } from "../../src/core/runtime/tools.js";

const InputSchema = z.object({
  path: z.string().optional(),
  recursive: z.boolean().optional(),
  maxDepth: z.number().int().min(0).max(25).optional(),
  includeHidden: z.boolean().optional(),
  maxResults: z.number().int().min(1).max(5000).optional(),
});

type LsEntry = {
  path: string;
  type: "file" | "dir" | "other";
  sizeBytes?: number;
};

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
  const startRel = parsed.path?.trim() ? parsed.path.trim() : ".";
  const startAbs = resolveInCwd(startRel);

  const recursive = parsed.recursive ?? false;
  const maxDepth = parsed.maxDepth ?? 5;
  const includeHidden = parsed.includeHidden ?? false;
  const maxResults = parsed.maxResults ?? 500;

  const out: LsEntry[] = [];

  async function walk(dirAbs: string, depth: number): Promise<void> {
    if (out.length >= maxResults) return;
    const entries = await readdir(dirAbs, { withFileTypes: true });

    for (const e of entries) {
      if (out.length >= maxResults) return;
      if (!includeHidden && e.name.startsWith(".")) continue;

      const childAbs = path.join(dirAbs, e.name);
      const childRel = path.relative(process.cwd(), childAbs) || ".";

      if (e.isDirectory()) {
        out.push({ path: childRel, type: "dir" });
        if (recursive && depth < maxDepth) await walk(childAbs, depth + 1);
        continue;
      }

      if (e.isFile()) {
        let sizeBytes: number | undefined;
        try {
          sizeBytes = (await stat(childAbs)).size;
        } catch {
          sizeBytes = undefined;
        }
        out.push({ path: childRel, type: "file", sizeBytes });
        continue;
      }

      out.push({ path: childRel, type: "other" });
    }
  }

  const st = await stat(startAbs);
  if (!st.isDirectory()) {
    throw new Error(`Not a directory: ${startRel}`);
  }

  await walk(startAbs, 0);
  return {
    root: path.relative(process.cwd(), startAbs) || ".",
    entries: out,
    truncated: out.length >= maxResults,
  };
};

