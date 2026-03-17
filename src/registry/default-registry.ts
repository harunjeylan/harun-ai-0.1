import { Registry } from "../core/registry.js";
import { loadAgentsFromDir, loadToolsFromDir, loadWorkflowsFromDir } from "./file-loader.js";

export async function createDefaultRegistry(): Promise<Registry> {
  const r = new Registry();

  await loadToolsFromDir("tools", r);
  loadAgentsFromDir("agents", r);

  loadWorkflowsFromDir("workflows", r);

  return r;
}
