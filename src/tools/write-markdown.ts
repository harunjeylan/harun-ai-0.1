import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ToolHandler } from "../core/runtime/tools.js";

export const writeMarkdown: ToolHandler = async (input) => {
  const topic = String(input.topic ?? "Untitled");
  const template = String(input.template ?? "generic");

  const now = new Date();
  const outDir = join(process.cwd(), "outputs");
  await mkdir(outDir, { recursive: true });

  const fileName = `proposal-${slugify(topic)}-${now.toISOString().slice(0, 10)}.md`;
  const outPath = join(outDir, fileName);

  const content =
    template === "proposal"
      ? proposalTemplate(topic)
      : `# ${topic}\n\nGenerated at ${now.toISOString()}\n`;

  await writeFile(outPath, content, "utf8");
  process.stdout.write(`Wrote: ${outPath}\n`);
};

function proposalTemplate(topic: string): string {
  return [
    `# Proposal: ${topic}`,
    "",
    "## 1. Background",
    "- Problem statement",
    "- Current pain points",
    "",
    "## 2. Objectives",
    "- Goal 1",
    "- Goal 2",
    "",
    "## 3. Scope",
    "- In scope",
    "- Out of scope",
    "",
    "## 4. Approach",
    "- High-level solution design",
    "- Milestones",
    "",
    "## 5. Deliverables",
    "- Document",
    "- Timeline",
    "",
    "## 6. Risks",
    "- Risk and mitigation",
    "",
  ].join("\n");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

