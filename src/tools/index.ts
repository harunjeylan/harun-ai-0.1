import type { ToolHandler } from "../core/runtime/tools.js";
import { renderPdf } from "./render-pdf.js";
import { renderTemplateMarkdown } from "./render-template-markdown.js";
import { sendTelegram } from "./send-telegram.js";
import { writeMarkdown } from "./write-markdown.js";

export function createTools(): Record<string, ToolHandler> {
  return {
    write_markdown: writeMarkdown,
    render_template_markdown: renderTemplateMarkdown,
    render_pdf: renderPdf,
    send_telegram: sendTelegram,
  };
}
