import { Registry } from "./registry.js";
import { WorkflowEngine } from "./workflow/engine.js";
import { Scheduler } from "./scheduler.js";
import { createDefaultRegistry } from "../registry/default-registry.js";
import { createToolRuntime } from "./runtime/tools.js";
import { Assistant } from "./assistant.js";

export type App = {
  registry: Registry;
  workflowEngine: WorkflowEngine;
  scheduler: Scheduler;
  assistant: Assistant;
};

export async function createApp(): Promise<App> {
  const registry = createDefaultRegistry();
  const runtime = createToolRuntime(registry);
  const workflowEngine = new WorkflowEngine(registry, runtime);
  const scheduler = new Scheduler(workflowEngine);
  const assistant = new Assistant({ registry, runtime, workflowEngine });

  return { registry, workflowEngine, scheduler, assistant };
}
