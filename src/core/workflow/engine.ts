import chalk from "chalk";
import type { Registry, WorkflowSpec, WorkflowStep } from "../registry.js";
import type { AgentRuntime } from "../runtime/agents.js";

export type WorkflowRunContext = {
  input: Record<string, unknown>;
};

type StepContext = Record<string, unknown>;

export class WorkflowEngine {
  constructor(
    private readonly registry: Registry,
    private readonly agentRuntime: AgentRuntime,
  ) { }

  async runByName(name: string, ctx: WorkflowRunContext) {
    const spec = this.registry.getWorkflow(name);
    if (!spec) throw new Error(`Unknown workflow: ${name}`);
    await this.run(spec, ctx);
  }

  async run(spec: WorkflowSpec, ctx: WorkflowRunContext) {
    process.stdout.write(chalk.bold(`\n▶ Workflow: ${spec.name}\n`));
    const stepOutputs: StepContext = {};

    await this.executeSteps(spec.steps, stepOutputs, ctx.input);
    process.stdout.write(chalk.green(`✓ Done: ${spec.name}\n\n`));
  }

  private async executeSteps(
    steps: WorkflowStep[],
    stepOutputs: StepContext,
    workflowInput: Record<string, unknown>,
  ): Promise<void> {
    let i = 0;
    while (i < steps.length) {
      const step = steps[i]!;

      if (step.mode === "parallel") {
        const parallelSteps: WorkflowStep[] = [step];
        while (i + 1 < steps.length && steps[i + 1]!.mode === "parallel") {
          parallelSteps.push(steps[i + 1]!);
          i++;
        }

        process.stdout.write(chalk.gray(`- Running ${parallelSteps.length} steps in parallel...\n`));
        const results = await Promise.all(
          parallelSteps.map(async (s) => {
            process.stdout.write(chalk.gray(`  • ${s.id}: ${s.agent}\n`));
            return this.agentRuntime.invoke(
              s.agent,
              s.input_schema,
              stepOutputs,
              workflowInput,
            );
          }),
        );

        for (let j = 0; j < parallelSteps.length; j++) {
          const s = parallelSteps[j]!;
          if (s.output_ref) {
            stepOutputs[s.id] = results[j];
          }
        }
      } else {
        process.stdout.write(chalk.gray(`- Step ${step.id}: ${step.agent}\n`));
        const result = await this.agentRuntime.invoke(
          step.agent,
          step.input_schema,
          stepOutputs,
          workflowInput,
        );

        if (step.output_ref) {
          stepOutputs[step.id] = result;
        }
      }

      i++;
    }
  }
}
