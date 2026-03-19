import type { ToolDeps, ToolHandler } from "../runtime/tools.js";
import { toolHandler as readHandler } from "./read/index.js";
import { toolHandler as writeHandler } from "./write/index.js";
import { toolHandler as bashHandler } from "./bash/index.js";
import { toolHandler as findHandler } from "./find/index.js";
import { toolHandler as grepHandler } from "./grep/index.js";
import { toolHandler as lsHandler } from "./ls/index.js";
import { toolHandler as renderPdfHandler } from "./render_pdf/index.js";
import { toolHandler as sendTelegramHandler } from "./send_telegram/index.js";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { createEditTool } from "./edit/index.js";

export function createTools(_deps: ToolDeps): Record<string, ToolHandler> {
  return {
    read: readHandler as unknown as ToolHandler,
    write: writeHandler as unknown as ToolHandler,
    bash: bashHandler as unknown as ToolHandler,
    find: findHandler as unknown as ToolHandler,
    grep: grepHandler as unknown as ToolHandler,
    ls: lsHandler as unknown as ToolHandler,
    render_pdf: renderPdfHandler,
    send_telegram: sendTelegramHandler,
  };
}

export function createAgentTools(deps: ToolDeps): AgentTool<any>[] {
  return [createEditTool({ cwd: deps.cwd })];
}
