import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import type { ToolHandler } from "../../src/core/runtime/tools.js";

const InputSchema = z.object({
  patch: z.string(),
  checkOnly: z.boolean().optional(),
});

function validatePatchPaths(patch: string): void {
  const bad: string[] = [];
  for (const line of patch.split("\n")) {
    // unified diff file markers
    if (!line.startsWith("+++ ") && !line.startsWith("--- ")) continue;
    const p = line.slice(4).trim();
    if (p === "/dev/null") continue;
    const cleaned = p.startsWith("a/") || p.startsWith("b/") ? p.slice(2) : p;
    if (!cleaned) continue;
    if (path.isAbsolute(cleaned)) bad.push(cleaned);
    if (cleaned.split(/[\\/]+/).includes("..")) bad.push(cleaned);
  }
  if (bad.length > 0) {
    throw new Error(`Patch contains unsafe paths: ${[...new Set(bad)].join(", ")}`);
  }
}

async function runGitApply(args: string[], patch: string): Promise<{ stdout: string; stderr: string }> {
  const child = spawn("git", args, { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout.on("data", (d) => stdoutChunks.push(Buffer.from(d)));
  child.stderr.on("data", (d) => stderrChunks.push(Buffer.from(d)));
  child.stdin.write(patch, "utf8");
  child.stdin.end();

  const exitCode: number = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  const stdout = Buffer.concat(stdoutChunks).toString("utf8");
  const stderr = Buffer.concat(stderrChunks).toString("utf8");
  if (exitCode !== 0) throw new Error(stderr.trim() || `git apply failed (${exitCode})`);
  return { stdout, stderr };
}

export const toolHandler: ToolHandler = async (input) => {
  const parsed = InputSchema.parse(input ?? {});
  const patch = parsed.patch;
  if (!patch.trim()) throw new Error("patch is required");
  validatePatchPaths(patch);

  const checkOnly = parsed.checkOnly ?? false;
  const args = ["apply", "--whitespace=nowarn"];
  if (checkOnly) args.push("--check");

  await runGitApply(args, patch);
  return { applied: !checkOnly, checked: checkOnly };
};

