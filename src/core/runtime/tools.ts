import type { Planner } from "../agents/planner.js";
import type { Registry } from "../registry.js";
import { createTools } from "../tools/index.js";

export type ToolInvokeInput = Record<string, unknown>;

export type ToolDeps = {
  planner: Planner;
  registry: Registry;
  cwd?: string;
};

export type ToolHandler = (
  input: ToolInvokeInput,
  deps: ToolDeps,
) => Promise<unknown>;

export type ToolRuntime = {
  invoke: (toolName: string, input: ToolInvokeInput) => Promise<unknown>;
};

export function createToolRuntime(
  registry: Registry,
  deps: { planner: Planner },
  cwd?: string,
): ToolRuntime {
  const toolDeps: ToolDeps = { planner: deps.planner, registry, cwd };
  const handlers = createTools(toolDeps);

  return {
    async invoke(toolName, input) {
      const spec = registry.getTool(toolName);
      if (!spec) throw new Error(`Tool not registered: ${toolName}`);
      const handler = handlers[toolName];
      if (!handler) throw new Error(`Tool handler missing: ${toolName}`);
      return await handler(input, toolDeps);
    },
  };
}
