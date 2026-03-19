#!/usr/bin/env bun
import { createDefaultRegistry } from "./registry/default-registry";
import { runTUI } from "./tui/index";
import { createApp } from "./core/app";

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

function printGlobalHelp() {
  process.stdout.write(
    [
      "",
      "HarunAI",
      "",
      "Usage:",
      "  harunai                 Start TUI",
      "  harunai tools           List all tools",
      "  harunai agents          List all agents",
      "  harunai workflows       List all workflows",
      "  harunai inspect <name>  Show details for a tool/agent/workflow",
      "  harunai --help          Show help",
      "",
    ].join("\n") + "\n",
  );
}

function cmdTools(registry: Awaited<ReturnType<typeof createDefaultRegistry>>) {
  const tools = registry.listTools();
  process.stdout.write("Available tools:\n\n");
  for (const name of tools) {
    const spec = registry.getTool(name);
    process.stdout.write(`  ${name}\n`);
    if (spec?.description) {
      process.stdout.write(`    ${spec.description}\n`);
    }
  }
  process.stdout.write("\n");
}

function cmdAgents(
  registry: Awaited<ReturnType<typeof createDefaultRegistry>>,
) {
  const agents = registry.listAgents();
  process.stdout.write("Available agents:\n\n");
  for (const name of agents) {
    const spec = registry.getAgent(name);
    process.stdout.write(`  ${name}\n`);
    if (spec?.description) {
      process.stdout.write(`    ${spec.description}\n`);
    }
    if (spec?.tools?.length) {
      process.stdout.write(`    tools: ${spec.tools.join(", ")}\n`);
    }
  }
  process.stdout.write("\n");
}

function cmdWorkflows(
  registry: Awaited<ReturnType<typeof createDefaultRegistry>>,
) {
  const workflows = registry.listWorkflows();
  process.stdout.write("Available workflows:\n\n");
  for (const name of workflows) {
    const spec = registry.getWorkflow(name);
    process.stdout.write(`  ${name}\n`);
    if (spec?.description) {
      process.stdout.write(`    ${spec.description}\n`);
    }
    if (spec?.steps?.length) {
      process.stdout.write(
        `    steps: ${spec.steps.map((s) => s.id).join(" → ")}\n`,
      );
    }
  }
  process.stdout.write("\n");
}

function cmdInspect(
  name: string,
  registry: Awaited<ReturnType<typeof createDefaultRegistry>>,
) {
  const tool = registry.getTool(name);
  if (tool) {
    process.stdout.write(`Tool: ${tool.name}\n\n`);
    if (tool.description)
      process.stdout.write(`Description: ${tool.description}\n`);
    if (tool.input_schema) {
      process.stdout.write(`Input Schema:\n`);
      process.stdout.write(`${JSON.stringify(tool.input_schema, null, 2)}\n`);
    }
    return;
  }

  const agent = registry.getAgent(name);
  if (agent) {
    process.stdout.write(`Agent: ${agent.name}\n\n`);
    if (agent.description)
      process.stdout.write(`Description: ${agent.description}\n`);
    if (agent.tools?.length) {
      process.stdout.write(`Tools: ${agent.tools.join(", ")}\n`);
    }
    if (agent.system_prompt) {
      process.stdout.write(`\nSystem Prompt:\n${agent.system_prompt}\n`);
    }
    return;
  }

  const workflow = registry.getWorkflow(name);
  if (workflow) {
    process.stdout.write(`Workflow: ${workflow.name}\n\n`);
    if (workflow.description)
      process.stdout.write(`Description: ${workflow.description}\n`);
    process.stdout.write(`Steps:\n`);
    for (const step of workflow.steps) {
      process.stdout.write(`  - ${step.id}: ${step.agent}\n`);
      if (step.input_schema && Object.keys(step.input_schema).length) {
        process.stdout.write(
          `    input_schema: ${JSON.stringify(step.input_schema)}\n`,
        );
      }
      if (step.output_ref) {
        process.stdout.write(`    output_ref: ${step.output_ref}\n`);
      }
    }
    return;
  }

  process.stderr.write(`Not found: ${name}\n`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);

  if (hasFlag(args, "--help") || hasFlag(args, "-h")) {
    printGlobalHelp();
    return;
  }

  const registry = await createDefaultRegistry();

  if (hasFlag(args, "tools")) {
    cmdTools(registry);
    return;
  }

  if (hasFlag(args, "agents")) {
    cmdAgents(registry);
    return;
  }

  if (hasFlag(args, "workflows")) {
    cmdWorkflows(registry);
    return;
  }

  const inspectArg = getArg(args, "inspect");
  if (inspectArg) {
    cmdInspect(inspectArg, registry);
    return;
  }

  if (args.length === 0) {
    const app = await createApp();
    await runTUI(app);
    return;
  }

  printGlobalHelp();
}

main().catch((err) => {
  process.stderr.write(
    `Fatal error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
