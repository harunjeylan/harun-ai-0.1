import { createDefaultRegistry } from "../registry/default-registry";
import { Assistant } from "./agents/assistant";
import { Registry } from "./registry";
import { createToolRuntime } from "./runtime/tools";
import { createAgentRuntime } from "./runtime/agents";
import { Scheduler } from "./scheduler";
import { WorkflowEngine } from "./workflow/engine";
import { Planner } from "./agents/planner";
import { WorkerAgent } from "./agents/worker";
import { SessionManager } from "../session/index";

export type App = {
  registry: Registry;
  workflowEngine: WorkflowEngine;
  scheduler: Scheduler;
  assistant: Assistant;
  planner: Planner;
  sessionManager: SessionManager;
};

export async function createApp(): Promise<App> {
  const registry = await createDefaultRegistry();
  const planner = new Planner(registry);
  const runtime = createToolRuntime(registry, { planner });
  const agentRuntime = createAgentRuntime(registry, runtime);
  const workflowEngine = new WorkflowEngine(registry, agentRuntime);
  const scheduler = new Scheduler(workflowEngine);
  const assistant = new Assistant({
    registry,
    runtime,
    workflowEngine,
    planner,
    cwd: process.cwd(),
  });

  const workers = new Map<string, WorkerAgent>();
  const workerNames = registry.listAgentsByType("worker");
  for (const name of workerNames) {
    try {
      const worker = WorkerAgent.create(name, registry, runtime);
      workers.set(name, worker);
    } catch (err) {
      console.warn(`[app] Failed to create worker "${name}":`, err);
    }
  }
  assistant.setWorkers(workers);

  // Use static factory method to create session manager
  const sessionManager = SessionManager.create(process.cwd());

  return { registry, workflowEngine, scheduler, assistant, planner, sessionManager };
}
