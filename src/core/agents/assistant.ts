import {
  Agent,
  type AgentEvent,
  type AgentTool,
} from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import chalk from "chalk";
import {
  getProviderConfigForAgent,
  resolveModel,
} from "../../providers/provider-registry";
import type { Registry } from "../registry";
import type { ToolRuntime } from "../runtime/tools";
import type { WorkflowEngine } from "../workflow/engine";
import type { Planner, PlanResult } from "./planner";
import { WorkerAgent } from "./worker";
import { createEditTool } from "../tools/edit/index.js";

export type AssistantEvent = AgentEvent;

export class Assistant {
  private readonly agent: Agent;
  readonly provider: string;
  readonly modelId: string;
  private readonly apiKey: string;

  private activeAgent: string = "assistant";
  private workers: Map<string, WorkerAgent> = new Map();

  constructor(
    private readonly deps: {
      registry: Registry;
      runtime: ToolRuntime;
      workflowEngine: WorkflowEngine;
      planner: Planner;
      cwd?: string;
    },
  ) {
    this.agent = new Agent();

    const cfg = getProviderConfigForAgent("assistant");
    this.provider = cfg.provider;
    this.modelId = cfg.modelId;
    this.apiKey = cfg.apiKey;

    this.agent.getApiKey = (provider) =>
      provider === this.provider ? this.apiKey : undefined;

    this.agent.setModel(resolveModel(cfg));

    const assistantSpec = this.deps.registry.getAgent("assistant");
    const systemPrompt = assistantSpec?.system_prompt?.trim();
    if (!systemPrompt) {
      throw new Error(
        'Missing system_prompt for agent "assistant" in agents/assistant.md',
      );
    }
    this.agent.setSystemPrompt(systemPrompt);

    this.agent.setTools(this.buildTools());
  }

  setWorkers(workers: Map<string, WorkerAgent>): void {
    this.workers = workers;
  }

  getActiveAgent(): string {
    return this.activeAgent;
  }

  getAvailableAgents(): string[] {
    return ["assistant", ...this.workers.keys()];
  }

  setActiveAgent(agentName: string): void {
    if (agentName === "assistant" || this.workers.has(agentName)) {
      this.activeAgent = agentName;
    }
  }

  cycleActiveAgent(): string {
    const agents = this.getAvailableAgents();
    const currentIndex = agents.indexOf(this.activeAgent);
    const nextIndex = (currentIndex + 1) % agents.length;
    this.activeAgent = agents[nextIndex]!;
    return this.activeAgent;
  }

  private buildTools(): AgentTool[] {
    const { runtime, registry, cwd } = this.deps;
    const tools: AgentTool<any>[] = [];

    // Add the enhanced edit tool with diff support
    tools.push(createEditTool({ cwd }) as AgentTool<any>);

    const toolNames = registry.listTools();

    for (const toolName of toolNames) {
      const toolSpec = registry.getTool(toolName);
      const inputSchema = toolSpec?.input_schema as any;
      tools.push({
        name: toolName,
        label: toolName
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        description: toolSpec?.description ?? `Execute ${toolName} tool.`,
        parameters: inputSchema ?? Type.Object({}),
        async execute(toolCallId, params) {
          try {
            await runtime.invoke(toolName, params as Record<string, unknown>);
            return {
              content: [{ type: "text", text: `Executed tool: ${toolName}` }],
              details: {},
            };
          } catch (err) {
            throw err;
          }
        },
      });
    }

    return tools;
  }

  subscribe(callback: (event: AgentEvent) => void): () => void {
    return this.agent.subscribe(callback);
  }

  async waitForIdle(): Promise<void> {
    return this.agent.waitForIdle();
  }

  abort(): void {
    this.agent.abort();
    for (const worker of this.workers.values()) {
      worker.abort();
    }
  }

  getLastAssistantText(): string | undefined {
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

    const fallback = String(content ?? "").trim();
    return fallback.length > 0 ? fallback : undefined;
  }

  hasApiKey(): boolean {
    return this.apiKey.trim().length > 0;
  }

  async prompt(text: string): Promise<{ content: string; error?: string }> {
    if (!this.hasApiKey()) {
      return {
        content: "",
        error: `Missing API key for provider "${this.provider}". Set it in config/providers/${this.provider}.json`,
      };
    }

    let fullResponse = "";
    let error: string | undefined;
    let sawResponse = false;

    const unsubscribe = this.agent.subscribe((e) => {
      const anyEvent = e as any;

      if (anyEvent?.type === "message_update") {
        const ev = anyEvent.assistantMessageEvent;
        if (ev?.type === "text_delta") {
          sawResponse = true;
          fullResponse += ev.delta;
        }
        if (ev?.type === "thinking_delta") {
          sawResponse = true;
          fullResponse += ev.delta;
        }
        if (ev?.type === "error") {
          error = ev.error?.errorMessage ?? "Unknown streaming error";
        }
        return;
      }

      if (anyEvent?.type === "message_end") {
        const msg = anyEvent?.message;
        if (msg?.stopReason === "error" && msg?.errorMessage) {
          error = msg.errorMessage;
        }
      }

      if (
        anyEvent?.type === "error" ||
        anyEvent?.type === "agent_error" ||
        anyEvent?.type === "turn_error"
      ) {
        error =
          anyEvent?.error?.errorMessage ??
          anyEvent?.error?.message ??
          anyEvent?.message ??
          "Unknown error";
      }
    });

    try {
      const timeoutMs = 45000;
      const timeout = setTimeout(() => {
        error = `Timed out after ${timeoutMs}ms. Check network/API key and try again.`;
        this.agent.abort();
      }, timeoutMs);

      try {
        await this.agent.prompt(text);
        await this.agent.waitForIdle();

        if (!sawResponse && !error) {
          const text = this.getLastAssistantText();
          if (text && text.trim().length > 0) {
            fullResponse = text;
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    } finally {
      unsubscribe();
    }

    return { content: fullResponse, error };
  }

  async invokeWorker(workerName: string, task: string): Promise<unknown> {
    const worker = this.workers.get(workerName);
    if (!worker) {
      throw new Error(`Worker not found: ${workerName}`);
    }
    return await worker.invoke(task);
  }

  async plan(goal: string): Promise<PlanResult> {
    return this.deps.planner.plan(goal);
  }

  async planAndRun(goal: string): Promise<void> {
    const plan = await this.plan(goal);

    if (plan.type === "error") {
      process.stdout.write(chalk.red(`[planner] ${plan.message}\n`));
      return;
    }

    if (plan.type === "use_existing") {
      process.stdout.write(
        chalk.cyan(`[planner] Using existing workflow: ${plan.workflowName}\n`),
      );
      await this.deps.workflowEngine.runByName(plan.workflowName, {
        input: {},
      });
      return;
    }

    if (plan.type === "create_new") {
      const wf = plan.workflow;
      process.stdout.write(
        chalk.cyan(`[planner] Created new workflow: ${wf.name}\n`),
      );
      process.stdout.write(chalk.gray(`Description: ${wf.description}\n`));
      process.stdout.write(
        chalk.gray(`Steps: ${wf.steps.map((s) => s.id).join(" → ")}\n`),
      );

      this.deps.planner.registerWorkflow(wf);
      await this.deps.workflowEngine.runByName(wf.name, { input: {} });
      return;
    }
  }
}
