import type { WorkflowEngine } from "./workflow/engine.js";

type Job = {
  workflowName: string;
  cron: string;
  timer: NodeJS.Timeout;
};

export class Scheduler {
  private jobs: Job[] = [];

  constructor(private readonly workflowEngine: WorkflowEngine) {}

  schedule(workflowName: string, cron: string) {
    const intervalMs = cronToIntervalMs(cron);
    const timer = setInterval(() => {
      this.workflowEngine
        .runByName(workflowName, { input: {} })
        .catch((err) =>
          process.stderr.write(`Scheduled run error: ${String(err)}\n`),
        );
    }, intervalMs);
    this.jobs.push({ workflowName, cron, timer });
  }

  stopAll() {
    for (const job of this.jobs) clearInterval(job.timer);
    this.jobs = [];
  }
}

function cronToIntervalMs(cron: string): number {
  // Minimal MVP: accept "*/N * * * *" as every N minutes; otherwise default to hourly.
  const m = cron.trim().match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
  if (m) {
    const minutes = Number(m[1]);
    if (!Number.isFinite(minutes) || minutes <= 0)
      throw new Error(`Invalid cron interval: ${cron}`);
    return minutes * 60_000;
  }
  // If user provides real 5-field cron (like "0 7 * * *"), this stub won't honor it precisely.
  return 60 * 60_000;
}
