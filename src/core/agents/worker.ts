import {
  Agent,
  type AgentTool,
  type AgentEvent,
} from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { AgentSpec, Registry } from "../registry";
import type { ToolRuntime } from "../runtime/tools";
import {
  getProviderConfigForAgent,
  resolveModel,
} from "../../providers/provider-registry";

export class WorkerAgent {
  private readonly agent: Agent;
  readonly name: string;
  readonly spec: AgentSpec;

  private constructor(name: string, spec: AgentSpec, agent: Agent) {
    this.name = name;
    this.spec = spec;
    this.agent = agent;
  }

  static create(
    name: string,
    registry: Registry,
    toolRuntime: ToolRuntime,
  ): WorkerAgent {
    const spec = registry.getAgent(name);
    if (!spec) {
      throw new Error(`Agent not registered: ${name}`);
    }

    const agent = new Agent();
    const cfg = getProviderConfigForAgent(name);
    agent.getApiKey = (provider) =>
      provider === cfg.provider ? cfg.apiKey : undefined;
    agent.setModel(resolveModel(cfg));

    const systemPrompt =
      spec.system_prompt?.trim() || `You are ${spec.description ?? name}.`;
    agent.setSystemPrompt(systemPrompt);

    const tools = WorkerAgent.buildTools(registry, toolRuntime, spec.tools);
    agent.setTools(tools);

    return new WorkerAgent(name, spec, agent);
  }

  private static buildTools(
    registry: Registry,
    toolRuntime: ToolRuntime,
    toolNames: string[],
  ): AgentTool[] {
    return toolNames.map((toolName) => {
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
  }

  subscribe(callback: (event: AgentEvent) => void): () => void {
    return this.agent.subscribe(callback);
  }

  async waitForIdle(): Promise<void> {
    return this.agent.waitForIdle();
  }

  abort(): void {
    this.agent.abort();
  }

  async invoke(task: string): Promise<unknown> {
    let result: unknown = null;

    const unsubscribe = this.agent.subscribe((event: AgentEvent) => {
      if (event.type === "message_update") {
        const ev = event.assistantMessageEvent;
        if (ev.type === "text_delta") {
          process.stdout.write(ev.delta);
        }
        if (ev.type === "done") {
          const state = (this.agent as any).state;
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
        this.agent.abort();
        process.stdout.write(`\n[worker] Timed out after ${timeoutMs}ms\n`);
      }, timeoutMs);

      try {
        await this.agent.prompt(task);
        await this.agent.waitForIdle();
      } finally {
        clearTimeout(timeout);
      }
    } finally {
      unsubscribe();
    }

    return result;
  }

  getLastText(): string | undefined {
    const state: any = (this.agent as any).state;
    const messages: any[] | undefined = state?.messages;
    if (!Array.isArray(messages)) return undefined;

    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m?.role === "assistant");
    if (!lastAssistant) return undefined;

    const content = lastAssistant?.content;
    if (typeof content === "string")
      return content.trim().length > 0 ? content : undefined;

    if (Array.isArray(content)) {
      const textParts = content
        .map((c: any) => (c?.type === "text" ? String(c.text ?? "") : ""))
        .filter((t: string) => t.trim().length > 0);
      if (textParts.length > 0) return textParts.join("\n");
    }

    return undefined;
  }
}
