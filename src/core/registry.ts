import { z } from "zod";

export const AgentTypeSchema = z.enum(["assistant", "planner", "worker"]);
export type AgentType = z.infer<typeof AgentTypeSchema>;

export const ToolSpecSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  input_schema: z.record(z.unknown()).optional(),
});
export type ToolSpec = z.infer<typeof ToolSpecSchema>;

export const AgentSpecSchema = z.object({
  name: z.string(),
  type: AgentTypeSchema.default("worker"),
  description: z.string().optional(),
  tools: z.array(z.string()).default([]),
  system_prompt: z.string().optional(),
});
export type AgentSpec = z.infer<typeof AgentSpecSchema>;

export const WorkflowStepSchema = z.object({
  id: z.string(),
  agent: z.string(),
  mode: z.enum(["sequential", "parallel"]).default("sequential"),
  input_schema: z.record(z.unknown()).optional(),
  input: z.record(z.unknown()).default({}),
  output_ref: z.string().optional(),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const WorkflowSpecSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  steps: z.array(WorkflowStepSchema),
});
export type WorkflowSpec = z.infer<typeof WorkflowSpecSchema>;

export class Registry {
  private agents = new Map<string, AgentSpec>();
  private tools = new Map<string, ToolSpec>();
  private workflows = new Map<string, WorkflowSpec>();

  registerAgent(spec: AgentSpec) {
    this.agents.set(spec.name, spec);
  }

  registerTool(spec: ToolSpec) {
    this.tools.set(spec.name, spec);
  }

  registerWorkflow(spec: WorkflowSpec) {
    this.workflows.set(spec.name, spec);
  }

  getAgent(name: string): AgentSpec | undefined {
    return this.agents.get(name);
  }

  getTool(name: string): ToolSpec | undefined {
    return this.tools.get(name);
  }

  getWorkflow(name: string): WorkflowSpec | undefined {
    return this.workflows.get(name);
  }

  getAllAgents(): AgentSpec[] {
    return [...this.agents.values()];
  }

  listAgents(): string[] {
    return [...this.agents.keys()].sort();
  }

  listAgentsByType(type: AgentType): string[] {
    return [...this.agents.values()]
      .filter((a) => a.type === type)
      .map((a) => a.name)
      .sort();
  }

  getAssistant(): AgentSpec | undefined {
    return [...this.agents.values()].find((a) => a.type === "assistant");
  }

  getPlanner(): AgentSpec | undefined {
    return [...this.agents.values()].find((a) => a.type === "planner");
  }

  getAllWorkflows(): WorkflowSpec[] {
    return [...this.workflows.values()];
  }

  listTools(): string[] {
    return [...this.tools.keys()].sort();
  }

  listWorkflows(): string[] {
    return [...this.workflows.keys()].sort();
  }
}
