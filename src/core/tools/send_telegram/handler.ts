import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import fs from "node:fs";
import { z } from "zod";
import { findLatestByExt, outputsDir, readLatestArtifacts } from "../util.js";
import type { ToolHandler } from "../../src/core/runtime/tools.js";

export const sendTelegram: ToolHandler = async (input) => {
    const parsed = SendTelegramInputSchema.parse(input ?? {});
    const cfg = readTelegramConfig();
    const token = cfg.botToken.trim();
    const chatId = cfg.chatId.trim();
    if (!token || !chatId) {
        throw new Error(
            "Missing Telegram config. Set config/telegram.json { botToken, chatId } to enable Telegram delivery.",
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
    return { chatId, filesSent: filePaths.length };
};

const SendTelegramInputSchema = z.object({
    message: z.string().optional(),
    caption: z.string().optional(),
    parseMode: z.enum(["Markdown", "HTML", "None"]).optional().default("None"),
    filePaths: z.array(z.string()).optional(),
});

function readTelegramConfig(): { botToken: string; chatId: string } {
    const p = "config/telegram.json";
    if (!fs.existsSync(p)) return { botToken: "", chatId: "" };
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as any;
    return {
        botToken: typeof parsed?.botToken === "string" ? parsed.botToken : "",
        chatId: typeof parsed?.chatId === "string" ? parsed.chatId : "",
    };
}

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

export const toolHandler: ToolHandler = sendTelegram;

