export const apply_diffDefination = {
  name: "apply_diff",
  description: "Apply a git diff/patch to the workspace.",
  inputSchema: {
    type: "object",
    properties: {
      patch: { type: "string", description: "Unified diff/patch text." },
    },
    required: ["patch"],
  },
} as const;
