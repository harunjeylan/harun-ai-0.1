export const send_telegramDefination = {
  name: "send_telegram",
  description: "Send a message via Telegram.",
  inputSchema: {
    type: "object",
    properties: {
      message: { type: "string", description: "Message text to send." },
    },
    required: ["message"],
  },
} as const;
