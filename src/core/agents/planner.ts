import { Agent } from "@mariozechner/pi-agent-core";
import {
  getProviderConfigForAgent,
  resolveModel,
} from "../../providers/provider-registry.js";
import type {
  AgentSpec,
  Registry,
  WorkflowSpec,
  WorkflowStep,
} from "../registry.js";

export type PlanResult =
  | { type: "use_existing"; workflowName: string; workflow: WorkflowSpec }
  | { type: "create_new"; workflow: WorkflowSpec }
  | { type: "error"; message: string };

interface ParsedPlan {
  type: "use_existing" | "create_new";
  workflow?: string;
  workflowSpec?: WorkflowSpec;
}

export class Planner {
  private readonly agent: Agent;
  private readonly registry: Registry;

  constructor(registry: Registry) {
    this.registry = registry;
    this.agent = new Agent();

    const cfg = getProviderConfigForAgent("planner");
    this.agent.getApiKey = (provider) =>
      provider === cfg.provider ? cfg.apiKey : undefined;
    this.agent.setModel(resolveModel(cfg));

    const plannerSpec = registry.getAgent("planner");
    const systemPrompt = plannerSpec?.system_prompt?.trim();
    if (!systemPrompt) {
      throw new Error(
        'Missing system_prompt for agent "planner" in agents/planner.md',
      );
    }
    this.agent.setSystemPrompt(systemPrompt);
    this.agent.setTools([]);
  }

  getAvailableAgents(): AgentSpec[] {
    return this.registry.getAllAgents().filter((a) => a.type === "worker");
  }

  getAvailableWorkflows(): WorkflowSpec[] {
    return this.registry.getAllWorkflows();
  }

  async plan(goal: string): Promise<PlanResult> {
    const workflows = this.getAvailableWorkflows();
    const agents = this.getAvailableAgents();

    const contextPrompt = this.buildPrompt(goal, workflows, agents);
    let result: string = "";
    const parseErrors: Error[] = [];
    let parsed: ParsedPlan | null = null;

    const unsubscribe = this.agent.subscribe((e: any) => {
      if (e?.type === "message_update") {
        const ev = e.assistantMessageEvent;
        if (ev?.type === "text_delta") {
          result += ev.delta;
        }
        if (ev?.type === "done") {
          try {
            parsed = this.parsePlanResult(result);
          } catch (err) {
            parseErrors.push(err as Error);
          }
        }
      }
    });

    try {
      const timeoutMs = 30000;
      const timeout = setTimeout(() => {
        this.agent.abort();
      }, timeoutMs);

      try {
        await this.agent.prompt(contextPrompt);
        await this.agent.waitForIdle();
      } finally {
        clearTimeout(timeout);
      }
    } finally {
      unsubscribe();
    }

    if (!parsed) {
      return {
        type: "error",
        message:
          parseErrors.length > 0
            ? `Parse error: ${parseErrors[0].message}`
            : "Failed to parse planner response",
      };
    }

    return this.processResult(parsed);
  }

  private buildPrompt(
    goal: string,
    workflows: WorkflowSpec[],
    agents: AgentSpec[],
  ): string {
    const workflowList = workflows
      .map((w) => `- ${w.name}: ${w.description ?? "No description"}`)
      .join("\n");

    const agentList = agents
      .map(
        (a) =>
          `- ${a.name}: ${a.description ?? "No description"} (tools: ${a.tools.join(", ")})`,
      )
      .join("\n");

    return `
USER GOAL: ${goal}

AVAILABLE WORKFLOWS:
${workflowList || "(none)"}

AVAILABLE WORKER AGENTS:
${agentList || "(none)"}

Analyze the goal above and determine:
1. Does an existing workflow match this goal?
2. If not, create a new workflow plan using worker agents.

Respond with ONLY valid JSON:

For existing workflow:
{"type": "use_existing", "workflow": "workflow_name"}

For new workflow:
{"type": "create_new", "workflow": {"name": "...", "description": "...", "steps": [...]}}

No other text.
`;
  }

  private processResult(parsed: ParsedPlan): PlanResult {
    const p = parsed as ParsedPlan;
    if (p.type === "use_existing" && p.workflow) {
      const workflow = this.registry.getWorkflow(p.workflow);
      if (!workflow) {
        return {
          type: "error",
          message: `Workflow "${p.workflow}" not found`,
        };
      }
      return {
        type: "use_existing",
        workflowName: p.workflow,
        workflow,
      };
    }

    if (p.type === "create_new" && p.workflowSpec) {
      return {
        type: "create_new",
        workflow: p.workflowSpec,
      };
    }

    return {
      type: "error",
      message: "Invalid planner response",
    };
  }

  private parsePlanResult(text: string): ParsedPlan {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const jsonStr = jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    if (parsed.type === "use_existing") {
      return {
        type: "use_existing",
        workflow: parsed.workflow,
      };
    }

    if (parsed.type === "create_new") {
      const workflow: WorkflowSpec = {
        name: parsed.workflow?.name,
        description: parsed.workflow?.description,
        steps: (parsed.workflow?.steps ?? []).map(
          (s: any): WorkflowStep => ({
            id: s.id,
            agent: s.agent,
            mode: s.mode ?? "sequential",
            input_schema: s.input_schema,
            input: s.input ?? {},
            output_ref: s.output_ref,
          }),
        ),
      };
      return {
        type: "create_new",
        workflowSpec: workflow,
      };
    }

    throw new Error("Invalid plan type");
  }

  registerWorkflow(workflow: WorkflowSpec): void {
    this.registry.registerWorkflow(workflow);
  }
}
