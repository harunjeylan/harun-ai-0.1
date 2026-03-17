import { createDefaultRegistry } from "../registry/default-registry.js";
import { Assistant } from "../agents/assistant.js";
import { Registry } from "./registry.js";
import { createToolRuntime } from "./runtime/tools.js";
import { createAgentRuntime } from "./runtime/agents.js";
import { Scheduler } from "./scheduler.js";
import { WorkflowEngine } from "./workflow/engine.js";
import { Planner } from "./agents/planner.js";
import { WorkerAgent } from "../agents/worker.js";

export type App = {
  registry: Registry;
  workflowEngine: WorkflowEngine;
  scheduler: Scheduler;
  assistant: Assistant;
  planner: Planner;
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

  return { registry, workflowEngine, scheduler, assistant, planner };
}
