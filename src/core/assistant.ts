import chalk from "chalk";
import {
  Agent,
  type AgentTool,
  type AgentEvent,
} from "@mariozechner/pi-agent-core";
import { Type, getEnvApiKey, getModel, type Model } from "@mariozechner/pi-ai";
import type { Registry } from "./registry.js";
import type { ToolRuntime } from "./runtime/tools.js";
import type { WorkflowEngine } from "./workflow/engine.js";

export class Assistant {
  private readonly agent: Agent;
  readonly provider: string;
  readonly modelId: string;

  constructor(
    private readonly deps: {
      registry: Registry;
      runtime: ToolRuntime;
      workflowEngine: WorkflowEngine;
    },
  ) {
    this.agent = new Agent();

    const inferredProvider =
      process.env.HARUNAI_PROVIDER ??
      process.env.AI_PROVIDER ??
      (process.env.OPENROUTER_API_KEY ? "openrouter" : undefined) ??
      "openai";
    this.provider = inferredProvider;

    const inferredModel =
      process.env.HARUNAI_MODEL ??
      (this.provider === "openrouter"
        ? process.env.OPENROUTER_MODEL
        : undefined) ??
      "gpt-4.1-mini";
    this.modelId = inferredModel;

    // Per pi-ai.md: pi-ai reads provider keys from env vars automatically via getEnvApiKey().
    // pi-agent-core supports overriding via getApiKey hook.
    this.agent.getApiKey = (provider) => getEnvApiKey(provider);

    this.agent.setModel(resolveModel(this.provider, this.modelId));

    this.agent.setSystemPrompt(
      [
        "You are HarunAI, a CLI-based Personal AI Operations System.",
        "You orchestrate workflows and call tools to produce real outputs.",
        "",
        "Rules:",
        "- Prefer running an existing workflow when it matches the request.",
        "- Otherwise call tools directly as needed.",
        "- Keep responses concise and actionable.",
        "- Avoid hard-coded document templates; prefer user-provided markdown templates.",
        "- When generating a document, use the render_template_markdown tool and ask for a template path if not provided.",
        "- Users can reference reusable skills in skills/ and rules in rules/; apply them when requested.",
      ].join("\n"),
    );

    this.agent.setTools(this.buildTools());
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

  hasApiKey(): boolean {
    return !!getEnvApiKey(this.provider);
  }

  async prompt(text: string) {
    const apiKey = getEnvApiKey(this.provider);
    if (!apiKey) {
      process.stdout.write(
        chalk.red(
          `[assistant] Missing API key for provider "${this.provider}". Set env var and retry.\n`,
        ),
      );
      process.stdout.write(
        chalk.gray(
          "See `pi-ai.md` for provider env vars (e.g. OPENROUTER_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY).\n",
        ),
      );
      return;
    }

    let sawAnyDelta = false;
    let sawDone = false;

    const unsubscribe = this.agent.subscribe((e) => {
      const anyEvent = e as any;

      if (anyEvent?.type === "message_update") {
        const ev = anyEvent.assistantMessageEvent;
        if (ev?.type === "text_delta") {
          sawAnyDelta = true;
          process.stdout.write(ev.delta);
        }
        if (ev?.type === "thinking_delta") {
          sawAnyDelta = true;
          process.stdout.write(chalk.gray(ev.delta));
        }
        if (ev?.type === "error") {
          sawAnyDelta = true;
          process.stdout.write(
            chalk.red(
              `\n[assistant error] ${ev.error?.errorMessage ?? "Unknown error"}\n`,
            ),
          );
        }
        if (ev?.type === "done") {
          sawDone = true;
          process.stdout.write("\n");
        }
        return;
      }

      // Some failures may surface as non-message_update events.
      if (
        anyEvent?.type === "error" ||
        anyEvent?.type === "agent_error" ||
        anyEvent?.type === "turn_error"
      ) {
        sawAnyDelta = true;
        const msg =
          anyEvent?.error?.errorMessage ??
          anyEvent?.error?.message ??
          anyEvent?.message ??
          "Unknown error";
        process.stdout.write(chalk.red(`\n[assistant error] ${msg}\n`));
      }
    });

    try {
      const timeoutMs = Number(process.env.HARUNAI_TIMEOUT_MS ?? "45000");
      const timeout = setTimeout(() => {
        process.stdout.write(
          chalk.red(
            `\n[assistant] Timed out after ${timeoutMs}ms. Check network/API key and try again.\n`,
          ),
        );
        this.agent.abort();
      }, timeoutMs);

      try {
        await this.agent.prompt(text);
        await this.agent.waitForIdle();

        if (!sawAnyDelta) {
          const state: any = (this.agent as any).state;
          const messages: any[] | undefined = state?.messages;
          const stateError = state?.error ? String(state.error) : "";
          const lastAssistant = Array.isArray(messages)
            ? [...messages].reverse().find((m) => m?.role === "assistant")
            : undefined;
          const content = (lastAssistant?.content ?? "").toString();

          if (content.trim().length > 0) {
            process.stdout.write(content);
            if (!content.endsWith("\n")) process.stdout.write("\n");
          } else if (stateError.trim().length > 0) {
            process.stdout.write(
              chalk.red(`\n[assistant error] ${stateError}\n`),
            );
          } else if (!sawDone) {
            process.stdout.write(
              chalk.yellow(
                `\n[assistant] No output received (provider=${this.provider}, model=${this.modelId}). Check HARUNAI_PROVIDER/HARUNAI_MODEL and network/API key.\n`,
              ),
            );
          }
        }
      } finally {
        clearTimeout(timeout);
      }
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
        return {
          content: [{ type: "text", text: `Ran workflow: ${name}` }],
          details: {},
        };
      },
    };

    const toolToAgentTool = (
      name: string,
      label: string,
      description: string,
      parameters: any,
    ): AgentTool => ({
      name,
      label,
      description,
      parameters,
      async execute(toolCallId, params) {
        void toolCallId;
        await runtime.invoke(name, params as Record<string, unknown>);
        return {
          content: [{ type: "text", text: `Executed tool: ${name}` }],
          details: {},
        };
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
  const model = getModel(provider as never, modelId as never) as Model<any>;
  if (provider !== "openrouter") return model;

  // OpenRouter-specific optional headers and base URL override.
  const headers: Record<string, string> = { ...(model.headers ?? {}) };
  if (process.env.OPENROUTER_HTTP_REFERER)
    headers["HTTP-Referer"] = process.env.OPENROUTER_HTTP_REFERER;
  if (process.env.OPENROUTER_X_TITLE)
    headers["X-Title"] = process.env.OPENROUTER_X_TITLE;

  const baseUrl = process.env.OPENROUTER_BASE_URL?.trim();
  return {
    ...model,
    baseUrl: baseUrl && baseUrl.length > 0 ? baseUrl : model.baseUrl,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  };
}
