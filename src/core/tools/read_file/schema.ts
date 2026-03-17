export const read_fileDefination = {
  name: "read_file",
  description: "Read a UTF-8 text file from the workspace.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path (relative to cwd)." },
      startLine: { type: "number", description: "1-based start line." },
      endLine: { type: "number", description: "1-based end line (inclusive)." },
      maxBytes: { type: "number", description: "Max bytes to read. Default: 200000." },
    },
    required: ["path"],
  },
} as const;
