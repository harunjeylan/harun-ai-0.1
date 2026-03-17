import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { z } from "zod";

import type { ToolHandler } from "../core/runtime/tools.js";
import {
  findLatestByExt,
  outputsDir,
  readLatestArtifacts,
  writeLatestArtifacts,
} from "./util.js";

export const renderPdf: ToolHandler = async (input) => {
  const parsed = RenderPdfInputSchema.parse(input ?? {});
  const outDir = outputsDir();
  await mkdir(outDir, { recursive: true });

  const mdPath = parsed.mdPath?.trim() ?? "";
  const srcPath = mdPath || (await findLatestMarkdown(outDir));
  if (!srcPath) {
    process.stdout.write("No markdown found to render.\n");
    return;
  }

  const md = await readFile(srcPath, "utf8");
  const pdfBytes = await renderMarkdownToPdfBytes(md, {
    title: parsed.title ?? basename(srcPath),
  });

  const pdfPath = srcPath.replace(/\.md$/i, ".pdf");
  await writeFile(pdfPath, Buffer.from(pdfBytes));
  await writeLatestArtifacts({ pdfPath, markdownPath: srcPath });
  process.stdout.write(`Rendered: ${pdfPath}\n`);
};

async function findLatestMarkdown(dir: string): Promise<string | null> {
  const latest = await readLatestArtifacts();
  if (latest.markdownPath) return latest.markdownPath;
  return await findLatestByExt(dir, ".md");
}

const RenderPdfInputSchema = z.object({
  mdPath: z.string().optional(),
  title: z.string().optional(),
});

async function renderMarkdownToPdfBytes(
  markdown: string,
  opts: { title: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(opts.title);
  doc.setCreator("HarunAI");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89]; // A4
  const margin = 48;
  const fontSize = 11;
  const lineHeight = 14;
  const width = pageSize[0] - margin * 2;
  const height = pageSize[1] - margin * 2;

  let page = doc.addPage(pageSize);
  let y = pageSize[1] - margin;

  const lines = markdownToPlainLines(markdown);
  const pushLine = (text: string, style: "normal" | "bold" = "normal") => {
    const usedFont = style === "bold" ? fontBold : font;
    for (const wrapped of wrapText(text, usedFont, fontSize, width)) {
      if (y - lineHeight < margin) {
        page = doc.addPage(pageSize);
        y = pageSize[1] - margin;
      }
      page.drawText(wrapped, {
        x: margin,
        y: y - lineHeight,
        size: fontSize,
        font: usedFont,
        color: rgb(0, 0, 0),
      });
      y -= lineHeight;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim().length === 0) {
      y -= lineHeight * 0.6;
      continue;
    }
    if (line.startsWith("# ")) {
      pushLine(line.slice(2).trim(), "bold");
      y -= lineHeight * 0.2;
      continue;
    }
    if (line.startsWith("## ")) {
      pushLine(line.slice(3).trim(), "bold");
      continue;
    }
    pushLine(line, "normal");
  }

  void height;
  return await doc.save();
}

function markdownToPlainLines(markdown: string): string[] {
  const out: string[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let inCode = false;
  for (const l of lines) {
    const line = l.replace(/\t/g, "  ");
    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      out.push(line);
      continue;
    }
    out.push(line);
  }
  return out;
}

function wrapText(
  text: string,
  font: any,
  fontSize: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let cur = words[0]!;

  for (const w of words.slice(1)) {
    const candidate = `${cur} ${w}`;
    const width = font.widthOfTextAtSize(candidate, fontSize);
    if (width <= maxWidth) cur = candidate;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  lines.push(cur);
  return lines;
}
