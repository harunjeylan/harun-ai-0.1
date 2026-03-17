import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { ToolHandler } from "../core/runtime/tools.js";
import { outputsDir, writeLatestArtifacts } from "./util.js";

export const renderTemplateMarkdown: ToolHandler = async (input) => {
  const parsed = RenderTemplateMarkdownSchema.parse(input ?? {});

  const templatePath = parsed.templatePath;
  const template = await readFile(templatePath, "utf8");

  const now = new Date();
  const outDir = outputsDir();
  await mkdir(outDir, { recursive: true });

  const topic = typeof parsed.data.topic === "string" ? parsed.data.topic : "Untitled";
  const date = now.toISOString().slice(0, 10);
  const fileName =
    parsed.outName?.trim().length
      ? safeFileName(parsed.outName)
      : `${parsed.prefix ?? "doc"}-${slugify(topic)}-${date}.md`;
  const outPath = join(outDir, fileName);

  const rendered = renderPlaceholders(template, {
    ...parsed.data,
    date: parsed.data.date ?? now.toISOString(),
  });

  await writeFile(outPath, rendered, "utf8");
  await writeLatestArtifacts({ markdownPath: outPath });
  process.stdout.write(`Wrote: ${outPath}\n`);
};

const RenderTemplateMarkdownSchema = z.object({
  templatePath: z.string().min(1),
  outName: z.string().optional(),
  prefix: z.string().optional(),
  data: z.record(z.unknown()).default({}),
});

function renderPlaceholders(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, path) => {
    const v = getByPath(data, String(path));
    if (v === undefined || v === null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    return JSON.stringify(v, null, 2);
  });
}

function getByPath(obj: unknown, path: string): unknown {
  let cur: any = obj;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

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

