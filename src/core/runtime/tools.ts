import { createTools } from "../../tools/index.js";
import type { Registry } from "../registry.js";

export type ToolInvokeInput = Record<string, unknown>;
export type ToolHandler = (input: ToolInvokeInput) => Promise<void>;

export type ToolRuntime = {
  invoke: (toolName: string, input: ToolInvokeInput) => Promise<void>;
};

export function createToolRuntime(registry: Registry): ToolRuntime {
  const handlers = createTools();

  return {
    async invoke(toolName, input) {
      const spec = registry.getTool(toolName);
      if (!spec) throw new Error(`Tool not registered: ${toolName}`);
      const handler = handlers[toolName];
      if (!handler) throw new Error(`Tool handler missing: ${toolName}`);
      await handler(input);
    },
  };
}
