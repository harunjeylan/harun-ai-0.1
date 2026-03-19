import { pathToFileURL } from "node:url";
import fs from "fs";
import path from "path";
import {
  AgentSpecSchema,
  Registry,
  ToolSpecSchema,
  WorkflowSpecSchema,
} from "../core/registry.js";

export function loadWorkflowsFromDir(dir: string, registry: Registry): void {
  if (!fs.existsSync(dir)) {
    console.warn(`[registry] Workflows directory not found: ${dir}`);
    return;
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith("on"));

  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content);

      const result = WorkflowSpecSchema.safeParse(parsed);
      if (!result.success) {
        console.warn(
          `[registry] Invalid workflow in ${file}:`,
          result.error.errors,
        );
        continue;
      }

      registry.registerWorkflow(result.data);
    } catch (err) {
      console.warn(`[registry] Failed to load workflow ${file}:`, err);
    }
  }
}

export function loadToolsFromFile(filePath: string, registry: Registry): void {
  if (!fs.existsSync(filePath)) {
    console.warn(`[registry] Tools file not found: ${filePath}`);
    return;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (!raw) {
      console.warn(`[registry] Tools file is empty: ${filePath}`);
      return;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      console.warn(`[registry] Tools file must be an array: ${filePath}`);
      return;
    }

    for (const item of parsed) {
      const result = ToolSpecSchema.safeParse(item);
      if (!result.success) {
        console.warn(
          `[registry] Invalid tool spec in ${filePath}:`,
          result.error.errors,
        );
        continue;
      }
      registry.registerTool(result.data);
    }
  } catch (err) {
    console.warn(`[registry] Failed to load tools from ${filePath}:`, err);
  }
}

export async function loadToolsFromDir(
  dir: string,
  registry: Registry,
): Promise<void> {
  if (!fs.existsSync(dir)) {
    console.warn(`[registry] Tools directory not found: ${dir}`);
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const toolDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => n !== "tool-template");

  for (const toolDirName of toolDirs) {
    const indexPathJs = path.join(dir, toolDirName, "index.js");
    const indexPathTs = path.join(dir, toolDirName, "index.ts");
    try {
      const indexPath = fs.existsSync(indexPathJs)
        ? indexPathJs
        : fs.existsSync(indexPathTs)
          ? indexPathTs
          : undefined;

      if (!indexPath) {
        // allow tools to exist as legacy single-file modules for now
        continue;
      }

      const mod = (await import(pathToFileURL(indexPath).href)) as Record<
        string,
        unknown
      >;

      const defKey = `${toolDirName}Defination`;
      const def = mod[defKey] as
        | {
            name: string;
            description?: string;
            inputSchema: any;
          }
        | undefined;

      if (!def) {
        console.warn(
          `[registry] Tool definition export missing: ${indexPath} (expected ${defKey})`,
        );
        continue;
      }

      const spec = {
        name: def.name,
        description: def.description,
        input_schema: def.inputSchema,
      };

      const result = ToolSpecSchema.safeParse(spec);
      if (!result.success) {
        console.warn(
          `[registry] Invalid tool spec from ${indexPath}:`,
          result.error.errors,
        );
        continue;
      }
      registry.registerTool(result.data);
    } catch (err) {
      console.warn(`[registry] Failed to load tool from ${toolDirName}:`, err);
    }
  }
}

export function loadAgentsFromFile(filePath: string, registry: Registry): void {
  if (!fs.existsSync(filePath)) {
    console.warn(`[registry] Agents file not found: ${filePath}`);
    return;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (!raw) {
      console.warn(`[registry] Agents file is empty: ${filePath}`);
      return;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      console.warn(`[registry] Agents file must be an array: ${filePath}`);
      return;
    }

    for (const item of parsed) {
      const result = AgentSpecSchema.safeParse(item);
      if (!result.success) {
        console.warn(
          `[registry] Invalid agent spec in ${filePath}:`,
          result.error.errors,
        );
        continue;
      }
      registry.registerAgent(result.data);
    }
  } catch (err) {
    console.warn(`[registry] Failed to load agents from ${filePath}:`, err);
  }
}

type ParsedAgentMarkdown = {
  name: string;
  type?: string;
  description?: string;
  tools: string[];
  system_prompt: string;
};

function parseAgentMarkdown(
  filePath: string,
  content: string,
): ParsedAgentMarkdown | null {
  const trimmed = content.replace(/\r\n/g, "\n");
  if (!trimmed.startsWith("---\n")) {
    console.warn(`[registry] Agent markdown missing frontmatter: ${filePath}`);
    return null;
  }

  const endIdx = trimmed.indexOf("\n---\n", 4);
  if (endIdx < 0) {
    console.warn(
      `[registry] Agent markdown frontmatter not closed: ${filePath}`,
    );
    return null;
  }

  const fmRaw = trimmed.slice(4, endIdx);
  const body = trimmed.slice(endIdx + "\n---\n".length).trim();
  if (!body) {
    console.warn(`[registry] Agent markdown body is empty: ${filePath}`);
    return null;
  }

  let name: string | undefined;
  let type: string | undefined;
  let description: string | undefined;
  const tools: string[] = [];
  let inTools = false;

  for (const line of fmRaw.split("\n")) {
    const rawLine = line.trimEnd();
    const l = rawLine.trim();
    if (!l) continue;

    if (/^tools\s*:/.test(l)) {
      inTools = true;
      continue;
    }

    if (inTools) {
      const m = l.match(/^-+\s*(.+)\s*$/);
      if (m) {
        tools.push(m[1].trim());
        continue;
      }
      inTools = false;
    }

    const kv = l.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const value = kv[2].trim();
    const unquoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value;

    if (key === "name") name = unquoted;
    if (key === "type") type = unquoted;
    if (key === "description") description = unquoted;
  }

  if (!name || name.trim().length === 0) {
    console.warn(`[registry] Agent markdown missing name: ${filePath}`);
    return null;
  }

  return {
    name: name.trim(),
    type: type?.trim() || "worker",
    description: description?.trim() || undefined,
    tools,
    system_prompt: body,
  };
}

export function loadAgentsFromDir(dir: string, registry: Registry): void {
  if (!fs.existsSync(dir)) {
    console.warn(`[registry] Agents directory not found: ${dir}`);
    return;
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    if (file === "agent-template.md") continue;
    const filePath = path.join(dir, file);
    const baseName = path.basename(file, ".md");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = parseAgentMarkdown(filePath, raw);
      if (!parsed) continue;

      if (parsed.name !== baseName) {
        console.warn(
          `[registry] Agent name must match filename: ${filePath} (name=${parsed.name})`,
        );
        continue;
      }

      const result = AgentSpecSchema.safeParse(parsed);
      if (!result.success) {
        console.warn(
          `[registry] Invalid agent spec in ${filePath}:`,
          result.error.errors,
        );
        continue;
      }

      registry.registerAgent(result.data);
    } catch (err) {
      console.warn(`[registry] Failed to load agent ${file}:`, err);
    }
  }
}
