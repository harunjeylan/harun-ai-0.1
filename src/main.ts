#!/usr/bin/env bun
import "dotenv/config";

import { runTui } from "./tui/index.js";

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function printGlobalHelp() {
  process.stdout.write(
    [
      "",
      "HarunAI",
      "",
      "Usage:",
      "  harunai                 Start TUI",
      "  harunai --help          Show help",
      "",
    ].join("\n") + "\n",
  );
}

async function main() {
  const args = process.argv.slice(2);

  if (hasFlag(args, "--help") || hasFlag(args, "-h")) {
    printGlobalHelp();
    return;
  }

  await runTui();
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

