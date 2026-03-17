import { z } from "zod";

export const ToolSpecSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});
export type ToolSpec = z.infer<typeof ToolSpecSchema>;

export const AgentSpecSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  tools: z.array(z.string()).default([]),
});
export type AgentSpec = z.infer<typeof AgentSpecSchema>;

export const WorkflowStepSchema = z.object({
  id: z.string(),
  tool: z.string(),
  input: z.record(z.unknown()).default({}),
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

  listAgents(): string[] {
    return [...this.agents.keys()].sort();
  }

  listTools(): string[] {
    return [...this.tools.keys()].sort();
  }

  listWorkflows(): string[] {
    return [...this.workflows.keys()].sort();
  }
}

