import type { ToolHandler } from "../../runtime/tools.js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { z } from "zod";
import { outputsDir, writeLatestArtifacts } from "../util";

export const renderPdf: ToolHandler = async (input, _deps) => {
  void _deps;
  const parsed = RenderPdfInputSchema.parse(input ?? {});

  if (!parsed.source?.trim()) {
    throw new Error("'source' (markdown content) is required");
  }

  const outDir = outputsDir();
  await mkdir(outDir, { recursive: true });

  const md = parsed.source;
  const outName = parsed.outName ?? "output";
  const srcPath = join(outDir, `${outName}.md`);
  await writeFile(srcPath, md, "utf8");

  const pdfBytes = await renderMarkdownToPdfBytes(md, {
    title: parsed.title ?? outName,
  });

  const pdfPath = srcPath.replace(/\.md$/i, ".pdf");
  await writeFile(pdfPath, Buffer.from(pdfBytes));
  await writeLatestArtifacts({ pdfPath, markdownPath: srcPath });
  process.stdout.write(`Rendered: ${pdfPath}\n`);
  return pdfPath;
};

const RenderPdfInputSchema = z.object({
  source: z.string().min(1),
  title: z.string().optional(),
  outName: z.string().optional(),
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

export const toolHandler: ToolHandler = renderPdf;
