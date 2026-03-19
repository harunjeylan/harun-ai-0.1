import {
  Agent,
  type AgentEvent,
  type AgentTool,
} from "@mariozechner/pi-agent-core";
import { type Model, Type } from "@mariozechner/pi-ai";
import {
  getProviderConfigForAgent,
  resolveModel,
} from "../../providers/provider-registry";
import type { Registry } from "../registry";
import type { ToolRuntime } from "./tools";

export type AgentRuntime = {
  invoke: (
    agentName: string,
    inputSchema: Record<string, unknown> | undefined,
    stepContext: Record<string, unknown>,
    workflowInput: Record<string, unknown>,
  ) => Promise<unknown>;
};

export function createAgentRuntime(
  registry: Registry,
  toolRuntime: ToolRuntime,
): AgentRuntime {
  const getAgentModel = (agentName: string): Model<any> => {
    const cfg = getProviderConfigForAgent(agentName);
    return resolveModel(cfg);
  };

  const buildToolsForAgent = (agentName: string): AgentTool[] => {
    const spec = registry.getAgent(agentName);
    if (!spec || !spec.tools || spec.tools.length === 0) {
      return [];
    }

    return spec.tools.map((toolName) => {
      const toolSpec = registry.getTool(toolName);
      return {
        name: toolName,
        label: toolName
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        description: toolSpec?.description ?? `Execute ${toolName}`,
        parameters: Type.Object({}),
        async execute(toolCallId, params) {
          void toolCallId;
          await toolRuntime.invoke(toolName, params as Record<string, unknown>);
          return {
            content: [{ type: "text", text: `Executed tool: ${toolName}` }],
            details: {},
          };
        },
      };
    });
  };

  return {
    async invoke(agentName, inputSchema, stepContext, workflowInput) {
      const spec = registry.getAgent(agentName);
      if (!spec) {
        throw new Error(`Agent not registered: ${agentName}`);
      }

      const agent = new Agent();
      const cfg = getProviderConfigForAgent(agentName);
      agent.getApiKey = (provider) =>
        provider === cfg.provider ? cfg.apiKey : undefined;
      agent.setModel(getAgentModel(agentName));

      const baseSystemPrompt =
        spec.system_prompt?.trim() ||
        `You are ${spec.description ?? agentName}.`;

      const contextInfo = buildContextInfo(
        inputSchema,
        stepContext,
        workflowInput,
      );
      const fullSystemPrompt = `${baseSystemPrompt}

${contextInfo}`;

      agent.setSystemPrompt(fullSystemPrompt);
      agent.setTools(buildToolsForAgent(agentName));

      const inputText = buildInputPrompt(
        inputSchema,
        stepContext,
        workflowInput,
      );

      let result: unknown = null;

      const unsubscribe = agent.subscribe((event: AgentEvent) => {
        if (event.type === "message_update") {
          const ev = event.assistantMessageEvent;
          if (ev.type === "text_delta") {
            process.stdout.write(ev.delta);
          }
          if (ev.type === "done") {
            const state = (agent as any).state;
            const messages = state?.messages as any[];
            const lastAssistant = messages
              ? [...messages].reverse().find((m) => m?.role === "assistant")
              : undefined;
            const content = (lastAssistant?.content ?? []).find(
              (c: any) => c.type === "text",
            );
            result = content?.text ?? null;
          }
        }
      });

      try {
        const timeoutMs = 45000;
        const timeout = setTimeout(() => {
          agent.abort();
          process.stdout.write(`\n[agent] Timed out after ${timeoutMs}ms\n`);
        }, timeoutMs);

        try {
          await agent.prompt(inputText);
          await agent.waitForIdle();
        } finally {
          clearTimeout(timeout);
        }
      } finally {
        unsubscribe();
      }

      return result;
    },
  };
}

function buildContextInfo(
  inputSchema: Record<string, unknown> | undefined,
  stepContext: Record<string, unknown>,
  workflowInput: Record<string, unknown>,
): string {
  const parts: string[] = [];

  if (inputSchema && Object.keys(inputSchema).length > 0) {
    parts.push(`INPUT SCHEMA:\n${JSON.stringify(inputSchema, null, 2)}`);
  }

  if (Object.keys(stepContext).length > 0) {
    parts.push(
      `PREVIOUS STEP OUTPUTS:\n${JSON.stringify(stepContext, null, 2)}`,
    );
  }

  if (Object.keys(workflowInput).length > 0) {
    parts.push(`WORKFLOW INPUT:\n${JSON.stringify(workflowInput, null, 2)}`);
  }

  if (parts.length === 0) {
    return "";
  }

  return `
=== CONTEXT ===
${parts.join("\n\n")}

Use the schema above to determine what inputs you need.
Values can come from previous step outputs, workflow input, or generated as appropriate.
Call your available tools to accomplish the task.
Return a summary of what was accomplished.
`;
}

function buildInputPrompt(
  inputSchema: Record<string, unknown> | undefined,
  stepContext: Record<string, unknown>,
  workflowInput: Record<string, unknown>,
): string {
  if (!inputSchema || Object.keys(inputSchema).length === 0) {
    if (Object.keys(stepContext).length > 0) {
      return `Execute your task using the context provided in the system prompt.
Previous step outputs and workflow input are available.`;
    }
    return "Execute your task.";
  }

  const props = inputSchema.properties as Record<string, unknown> | undefined;
  if (!props || Object.keys(props).length === 0) {
    return "Execute your task using the provided schema.";
  }

  const required = (inputSchema.required as string[]) ?? [];

  return `Execute your task.

Required inputs: ${required.join(", ") || "none"}
Available inputs from schema: ${Object.keys(props).join(", ")}
`;
}
