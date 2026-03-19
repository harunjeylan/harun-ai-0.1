import { fileURLToPath } from "node:url";
import { Registry } from "../core/registry";
import {
  loadAgentsFromDir,
  loadToolsFromDir,
  loadWorkflowsFromDir,
} from "./file-loader";

export async function createDefaultRegistry(): Promise<Registry> {
  const r = new Registry();

  const toolsDir = fileURLToPath(new URL("../core/tools", import.meta.url));
  await loadToolsFromDir(toolsDir, r);
  loadAgentsFromDir("config/agents", r);
  loadWorkflowsFromDir("config/workflows", r);

  return r;
}
