export const rgDefination = {
  name: "rg",
  description: "Search text in files using ripgrep.",
  inputSchema: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Search pattern." },
      path: { type: "string", description: "Directory to search. Default: current directory." },
    },
    required: ["pattern"],
  },
} as const;
