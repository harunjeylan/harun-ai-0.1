#!/usr/bin/env bun
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";
import chalk from "chalk";
import { createApp } from "./core/app.js";
import { listPiModels, listPiProviders } from "./toolkit/pi.js";

function printHelp() {
  stdout.write(
    [
      "",
      chalk.bold("HarunAI CLI"),
      "",
      "Modes:",
      "  Chat: type normally (goes to Assistant Agent)",
      "  Command: start with '/' (e.g. /list workflows)",
      "",
      "Commands:",
      "  /help                              Show this help",
      "  /list agents|tools|workflows        List registry items",
      "  /run <workflowName>                Run a workflow",
      "  /propose <topic>                   Create proposal (runs a workflow via assistant)",
      "  /schedule <workflowName> <cron>    Schedule a workflow (cron syntax)",
      "  /pi providers                      List pi-ai providers",
      "  /pi models <provider>              List pi-ai models for provider",
      "  /exit                              Quit",
      "",
      "Examples:",
      "  Create proposal for bus subscription platform",
      "  /list workflows",
      "  /run proposal_delivery",
      '  /schedule ai_news_daily "*/10 * * * *"',
      "  /pi providers",
      "  /pi models openai",
      "",
    ].join("\n"),
  );
}

const app = await createApp();
printHelp();

const rl = createInterface({
  input: stdin,
  output: stdout,
  prompt: chalk.cyan("> "),
});
rl.prompt();

rl.on("line", async (line) => {
  const input = line.trim();
  if (!input) {
    rl.prompt();
    return;
  }

  try {
    if (!input.startsWith("/")) {
      await app.assistant.prompt(input);
      rl.prompt();
      return;
    }

    const commandLine = input.slice(1);
    const [cmd, ...rest] = splitArgs(commandLine);
    if (!cmd) {
      rl.prompt();
      return;
    }

    if (cmd === "help") {
      printHelp();
      rl.prompt();
      return;
    }
    if (cmd === "exit" || cmd === "quit") {
      rl.close();
      return;
    }

    if (cmd === "list") {
      const what = rest[0];
      if (what === "agents")
        stdout.write(app.registry.listAgents().join("\n") + "\n");
      else if (what === "tools")
        stdout.write(app.registry.listTools().join("\n") + "\n");
      else if (what === "workflows")
        stdout.write(app.registry.listWorkflows().join("\n") + "\n");
      else stdout.write("Usage: /list agents|tools|workflows\n");
      rl.prompt();
      return;
    }

    if (cmd === "run") {
      const name = rest[0];
      if (!name) {
        stdout.write("Usage: /run <workflowName>\n");
        rl.prompt();
        return;
      }
      await app.workflowEngine.runByName(name, { input: {} });
      rl.prompt();
      return;
    }

    if (cmd === "propose") {
      const topic = rest.join(" ").trim();
      if (!topic) {
        stdout.write("Usage: /propose <topic>\n");
        rl.prompt();
        return;
      }
      await app.assistant.prompt(
        `Create a proposal for: ${topic}\nUse the proposal_delivery workflow.`,
      );
      rl.prompt();
      return;
    }

    if (cmd === "schedule") {
      const workflowName = rest[0];
      const cron = rest.slice(1).join(" ").trim();
      if (!workflowName || !cron) {
        stdout.write("Usage: /schedule <workflowName> <cron>\n");
        rl.prompt();
        return;
      }
      app.scheduler.schedule(workflowName, cron);
      stdout.write(
        chalk.green(`Scheduled ${workflowName} with cron: ${cron}\n`),
      );
      rl.prompt();
      return;
    }

    if (cmd === "pi") {
      const sub = rest[0];
      if (sub === "providers") {
        stdout.write(listPiProviders().join("\n") + "\n");
        rl.prompt();
        return;
      }
      if (sub === "models") {
        const provider = rest[1];
        if (!provider) {
          stdout.write("Usage: /pi models <provider>\n");
          rl.prompt();
          return;
        }
        stdout.write(listPiModels(provider).join("\n") + "\n");
        rl.prompt();
        return;
      }
      stdout.write(
        "Usage: /pi providers | /pi models <provider>\n",
      );
      rl.prompt();
      return;
    }

    stdout.write(`Unknown command: ${cmd}\n`);
    rl.prompt();
  } catch (err) {
    stdout.write(
      chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}\n`),
    );
    rl.prompt();
  }
});

rl.on("close", () => {
  app.scheduler.stopAll();
  stdout.write("\n");
  process.exit(0);
});

function splitArgs(input: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
