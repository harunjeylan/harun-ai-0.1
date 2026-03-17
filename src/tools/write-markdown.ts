import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

import type { ToolHandler } from "../core/runtime/tools.js";
import { outputsDir, writeLatestArtifacts } from "./util.js";

export const writeMarkdown: ToolHandler = async (input) => {
  const parsed = WriteMarkdownInputSchema.parse(input ?? {});
  const topic = parsed.topic ?? "Untitled";

  const now = new Date();
  const outDir = outputsDir();
  await mkdir(outDir, { recursive: true });

  const date = now.toISOString().slice(0, 10);
  const fileName =
    parsed.outName?.trim().length
      ? safeFileName(parsed.outName)
      : `${parsed.prefix ?? "proposal"}-${slugify(topic)}-${date}.md`;
  const outPath = join(outDir, fileName);

  const content = `# ${topic}\n\nGenerated at ${now.toISOString()}\n`;

  await writeFile(outPath, content, "utf8");
  await writeLatestArtifacts({ markdownPath: outPath });
  process.stdout.write(`Wrote: ${outPath}\n`);
};

const WriteMarkdownInputSchema = z.object({
  topic: z.string().optional(),
  prefix: z.string().optional(),
  outName: z.string().optional(),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function safeFileName(name: string): string {
  const trimmed = name.trim();
  const base = trimmed.replace(/[\/\\?%*:|"<>]/g, "-");
  return base.length > 0 ? base : "output.md";
}

