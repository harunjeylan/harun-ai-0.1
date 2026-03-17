import chalk from "chalk";
import type { Registry, WorkflowSpec } from "../registry.js";
import type { ToolRuntime } from "../runtime/tools.js";

export type WorkflowRunContext = {
  input: Record<string, unknown>;
};

export class WorkflowEngine {
  constructor(
    private readonly registry: Registry,
    private readonly runtime: ToolRuntime,
  ) {}

  async runByName(name: string, ctx: WorkflowRunContext) {
    const spec = this.registry.getWorkflow(name);
    if (!spec) throw new Error(`Unknown workflow: ${name}`);
    await this.run(spec, ctx);
  }

  async run(spec: WorkflowSpec, ctx: WorkflowRunContext) {
    process.stdout.write(chalk.bold(`\n▶ Workflow: ${spec.name}\n`));
    for (const step of spec.steps) {
      process.stdout.write(chalk.gray(`- Step ${step.id}: ${step.tool}\n`));
      await this.runtime.invoke(step.tool, { ...ctx.input, ...step.input });
    }
    process.stdout.write(chalk.green(`✓ Done: ${spec.name}\n\n`));
  }
}

