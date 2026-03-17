import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import type { ToolHandler } from "../../src/core/runtime/tools.js";

const InputSchema = z.object({
  pattern: z.string(),
  cwd: z.string().optional(),
  glob: z.string().optional(),
  caseSensitive: z.boolean().optional(),
  maxResults: z.number().int().min(1).max(5000).optional(),
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
  const searchDir = resolveInCwd(parsed.cwd?.trim() ? parsed.cwd.trim() : ".");
  const maxResults = parsed.maxResults ?? 200;
  const caseSensitive = parsed.caseSensitive ?? true;

  const args = [
    "--line-number",
    "--column",
    "--no-heading",
    "--max-count",
    String(maxResults),
  ];
  if (!caseSensitive) args.push("--ignore-case");
  if (parsed.glob?.trim()) args.push("--glob", parsed.glob.trim());
  args.push(parsed.pattern);
  args.push(searchDir);

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  const child = spawn("rg", args, { stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (d) => stdoutChunks.push(Buffer.from(d)));
  child.stderr.on("data", (d) => stderrChunks.push(Buffer.from(d)));

  const exitCode: number = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  const stdout = Buffer.concat(stdoutChunks).toString("utf8");
  const stderr = Buffer.concat(stderrChunks).toString("utf8");

  // rg exit 1 means "no matches"
  if (exitCode !== 0 && exitCode !== 1) {
    throw new Error(stderr.trim() || `rg failed with exit code ${exitCode}`);
  }

  const matches = stdout
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      const first = line.indexOf(":");
      const second = first >= 0 ? line.indexOf(":", first + 1) : -1;
      const third = second >= 0 ? line.indexOf(":", second + 1) : -1;
      if (first < 0 || second < 0 || third < 0) {
        return { raw: line };
      }
      const file = line.slice(0, first);
      const lineNo = Number(line.slice(first + 1, second));
      const colNo = Number(line.slice(second + 1, third));
      const text = line.slice(third + 1);
      return { file, line: lineNo, column: colNo, text };
    });

  return {
    cwd: path.relative(process.cwd(), searchDir) || ".",
    pattern: parsed.pattern,
    matches,
    count: matches.length,
    truncated: matches.length >= maxResults,
  };
};

