import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ToolHandler } from "../core/runtime/tools.js";

export const renderPdf: ToolHandler = async (input) => {
  // MVP placeholder: wraps markdown into a very simple PDF-like text file.
  // Replace with a real PDF generator (e.g., puppeteer) later.
  const outDir = join(process.cwd(), "outputs");
  await mkdir(outDir, { recursive: true });

  const mdPath = String(input.mdPath ?? "");
  const srcPath = mdPath || await findLatestMarkdown(outDir);
  if (!srcPath) {
    process.stdout.write("No markdown found to render.\n");
    return;
  }

  const md = await readFile(srcPath, "utf8");
  const pdfPath = srcPath.replace(/\.md$/i, ".pdf.txt");
  const pseudoPdf = [`[PDF PLACEHOLDER]`, `Source: ${srcPath}`, "", md].join("\n");

  await writeFile(pdfPath, pseudoPdf, "utf8");
  process.stdout.write(`Rendered (placeholder): ${pdfPath}\n`);
};

async function findLatestMarkdown(dir: string): Promise<string | null> {
  const { readdir, stat } = await import("node:fs/promises");
  const entries = await readdir(dir);
  const mds = entries.filter((e) => e.endsWith(".md")).map((e) => join(dir, e));
  if (mds.length === 0) return null;

  let latest = mds[0]!;
  let latestMtime = (await stat(latest)).mtimeMs;
  for (const p of mds.slice(1)) {
    const m = (await stat(p)).mtimeMs;
    if (m > latestMtime) {
      latestMtime = m;
      latest = p;
    }
  }
  return latest;
}

