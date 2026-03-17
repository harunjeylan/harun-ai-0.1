import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolDeps, ToolHandler } from "../runtime/tools.js";

export function createTools(deps: ToolDeps): Record<string, ToolHandler> {
  const toolsDir = path.join(process.cwd(), "tools");
  const handlers: Record<string, ToolHandler> = {};

  if (!fs.existsSync(toolsDir)) return handlers;

  const entries = fs.readdirSync(toolsDir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name === "tool-template") continue;

    const indexPath = path.join(toolsDir, e.name, "index.ts");
    if (!fs.existsSync(indexPath)) continue;

    // NOTE: dynamic import is async, but ToolRuntime expects sync creation.
    // Bun supports synchronous require-like import() only as Promise, so we precompute a lazy handler.
    // This keeps behavior deterministic without a big refactor.
    const toolName = e.name;
    handlers[toolName] = async (input) => {
      const mod = (await import(pathToFileURL(indexPath).href)) as any;
      const handler = mod.toolHandler as ToolHandler | undefined;
      if (!handler) throw new Error(`Tool handler missing: ${toolName}`);
      return await handler(input, deps);
    };
  }

  return handlers;
}
