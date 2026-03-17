import type { ToolHandler } from "../core/runtime/tools.js";

export const sendTelegram: ToolHandler = async (input) => {
  const message = input.message ? String(input.message) : "Delivered outputs (stub).";
  process.stdout.write(`[telegram stub] ${message}\n`);
};

