import chalk from "chalk";
import { Agent, type AgentTool } from "@mariozechner/pi-agent-core";
import { Type, getModel, type Model } from "@mariozechner/pi-ai";
import type { Registry } from "./registry.js";
import type { ToolRuntime } from "./runtime/tools.js";
import type { WorkflowEngine } from "./workflow/engine.js";

export class Assistant {
  private readonly agent: Agent;

  constructor(
    private readonly deps: {
      registry: Registry;
      runtime: ToolRuntime;
      workflowEngine: WorkflowEngine;
    },
  ) {
    this.agent = new Agent();

    this.agent.getApiKey = (provider) => getApiKeyForProvider(provider);

    const provider = process.env.HARUNAI_PROVIDER ?? "openai";
    const modelId = process.env.HARUNAI_MODEL ?? "gpt-4.1-mini";
    this.agent.setModel(resolveModel(provider, modelId));

    this.agent.setSystemPrompt(
      [
        "You are HarunAI, a CLI-based Personal AI Operations System.",
        "You orchestrate workflows and call tools to produce real outputs.",
        "",
        "Rules:",
        "- Prefer running an existing workflow when it matches the request.",
        "- Otherwise call tools directly as needed.",
        "- Keep responses concise and actionable.",
      ].join("\n"),
    );

    this.agent.setTools(this.buildTools());
  }

  async prompt(text: string) {
    const unsubscribe = this.agent.subscribe((e) => {
      if (e.type === "message_update") {
        const ev = e.assistantMessageEvent;
        if (ev.type === "text_delta") process.stdout.write(ev.delta);
        if (ev.type === "thinking_delta") process.stdout.write(chalk.gray(ev.delta));
        if (ev.type === "error")
          process.stdout.write(
            chalk.red(`\n[assistant error] ${ev.error.errorMessage ?? "Unknown error"}\n`),
          );
        if (ev.type === "done") process.stdout.write("\n");
      }
    });

    try {
      await this.agent.prompt(text);
      await this.agent.waitForIdle();
    } finally {
      unsubscribe();
    }
  }

  private buildTools(): AgentTool[] {
    const { runtime, workflowEngine, registry } = this.deps;
    const wfNames = registry.listWorkflows();

    const runWorkflow: AgentTool = {
      name: "run_workflow",
      label: "Run Workflow",
      description: "Run a named workflow from the workflow registry.",
      parameters: Type.Object({
        name: Type.Union(wfNames.map((n) => Type.Literal(n)) as any),
        input: Type.Optional(Type.Record(Type.String(), Type.Any())),
      }),
      async execute(toolCallId, params) {
        void toolCallId;
        const name = (params as any).name as string;
        const input = ((params as any).input ?? {}) as Record<string, unknown>;
        await workflowEngine.runByName(name, { input });
        return { content: [{ type: "text", text: `Ran workflow: ${name}` }], details: {} };
      },
    };

    const toolToAgentTool = (name: string, label: string, description: string, parameters: any): AgentTool => ({
      name,
      label,
      description,
      parameters,
      async execute(toolCallId, params) {
        void toolCallId;
        await runtime.invoke(name, params as Record<string, unknown>);
        return { content: [{ type: "text", text: `Executed tool: ${name}` }], details: {} };
      },
    });

    return [
      runWorkflow,
      toolToAgentTool(
        "write_markdown",
        "Write Markdown",
        "Write a markdown output file to outputs/.",
        Type.Object({
          topic: Type.Optional(Type.String()),
          template: Type.Optional(Type.String()),
        }),
      ),
      toolToAgentTool(
        "render_pdf",
        "Render PDF",
        "Render a PDF (placeholder) from the latest markdown output.",
        Type.Object({
          mdPath: Type.Optional(Type.String()),
        }),
      ),
      toolToAgentTool(
        "send_telegram",
        "Send Telegram",
        "Stub: print what would be sent to Telegram.",
        Type.Object({
          message: Type.Optional(Type.String()),
        }),
      ),
    ];
  }
}

function resolveModel(provider: string, modelId: string): Model<any> {
  if (provider === "openrouter") return createOpenRouterModel(modelId);
  return getModel(provider as never, modelId as never);
}

function createOpenRouterModel(modelId: string): Model<"openai-completions"> {
  const baseUrl = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
  const headers: Record<string, string> = {};

  if (process.env.OPENROUTER_HTTP_REFERER) headers["HTTP-Referer"] = process.env.OPENROUTER_HTTP_REFERER;
  if (process.env.OPENROUTER_X_TITLE) headers["X-Title"] = process.env.OPENROUTER_X_TITLE;

  return {
    id: modelId,
    name: modelId,
    api: "openai-completions",
    provider: "openrouter",
    baseUrl,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 32_768,
    maxTokens: 8_192,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    compat: {
      openRouterRouting: {
        // Let OpenRouter decide unless user pins providers.
      },
    },
  };
}

function getApiKeyForProvider(provider: string): string | undefined {
  if (provider === "openrouter") return process.env.OPENROUTER_API_KEY;
  if (provider === "openai") return process.env.OPENAI_API_KEY;
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY;
  if (provider === "google") return process.env.GOOGLE_API_KEY;
  return undefined;
}
