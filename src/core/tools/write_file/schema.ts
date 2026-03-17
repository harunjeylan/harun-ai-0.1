export const write_fileDefination = {
  name: "write_file",
  description: "Write a UTF-8 text file into the workspace (creates parent dirs).",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path (relative to cwd)." },
      content: { type: "string", description: "Full file content to write." },
      overwrite: { type: "boolean", description: "Allow overwriting. Default: true." },
    },
    required: ["path", "content"],
  },
} as const;
