import type { ToolHandler } from "../core/runtime/tools.js";
import { writeMarkdown } from "./write-markdown.js";
import { renderPdf } from "./render-pdf.js";
import { sendTelegram } from "./send-telegram.js";

export function createTools(): Record<string, ToolHandler> {
  return {
    write_markdown: writeMarkdown,
    render_pdf: renderPdf,
    send_telegram: sendTelegram,
  };
}

