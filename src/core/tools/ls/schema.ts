export const lsDefination = {
  name: "ls",
  description: "List files and directories.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Directory path. Default: current directory." },
      recursive: { type: "boolean", description: "List recursively. Default: false." },
    },
  },
} as const;
