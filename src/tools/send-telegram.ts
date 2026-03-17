import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { z } from "zod";
import type { ToolHandler } from "../core/runtime/tools.js";
import { findLatestByExt, outputsDir, readLatestArtifacts } from "./util.js";

export const sendTelegram: ToolHandler = async (input) => {
  const parsed = SendTelegramInputSchema.parse(input ?? {});
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    throw new Error(
      "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID. Set them to enable Telegram delivery.",
    );
  }

  const message = parsed.message ?? "Delivered outputs.";
  await sendMessage({
    token,
    chatId,
    text: message,
    parseMode: parsed.parseMode,
  });

  const filePaths =
    parsed.filePaths && parsed.filePaths.length > 0
      ? parsed.filePaths
      : await defaultFilesToSend();

  for (const p of filePaths) {
    await sendDocument({ token, chatId, filePath: p, caption: parsed.caption });
  }

  process.stdout.write(
    `[telegram] Sent message${filePaths.length ? ` + ${filePaths.length} file(s)` : ""} to chat ${chatId}\n`,
  );
};

const SendTelegramInputSchema = z.object({
  message: z.string().optional(),
  caption: z.string().optional(),
  parseMode: z.enum(["Markdown", "HTML", "None"]).optional().default("None"),
  filePaths: z.array(z.string()).optional(),
});

async function defaultFilesToSend(): Promise<string[]> {
  const latest = await readLatestArtifacts();
  if (latest.pdfPath) return [latest.pdfPath];
  const dir = outputsDir();
  const maybePdf = await findLatestByExt(dir, ".pdf");
  return maybePdf ? [maybePdf] : [];
}

async function sendMessage(args: {
  token: string;
  chatId: string;
  text: string;
  parseMode: "Markdown" | "HTML" | "None";
}) {
  const url = `https://api.telegram.org/bot${args.token}/sendMessage`;
  const body = new URLSearchParams();
  body.set("chat_id", args.chatId);
  body.set("text", args.text);
  if (args.parseMode !== "None") body.set("parse_mode", args.parseMode);

  const res = await fetch(url, { method: "POST", body });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Telegram sendMessage failed (${res.status}): ${text}`);
  }
}

async function sendDocument(args: {
  token: string;
  chatId: string;
  filePath: string;
  caption?: string;
}) {
  let buf: Buffer;
  try {
    buf = await readFile(args.filePath);
  } catch {
    throw new Error(`File not found: ${args.filePath}`);
  }

  const url = `https://api.telegram.org/bot${args.token}/sendDocument`;
  const form = new FormData();
  form.set("chat_id", args.chatId);
  const bytes = new Uint8Array(buf);
  const blob = new Blob([bytes]);
  form.append("document", blob, basename(args.filePath));
  if (args.caption?.trim()) form.set("caption", args.caption.trim());

  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Telegram sendDocument failed (${res.status}): ${text}`);
  }
}
