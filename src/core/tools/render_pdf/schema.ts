export const render_pdfDefination = {
  name: "render_pdf",
  description: "Render a PDF from markdown content.",
  inputSchema: {
    type: "object",
    properties: {
      source: { type: "string", description: "Markdown content to render as PDF." },
      title: { type: "string", description: "PDF title." },
      outName: { type: "string", description: "Output filename." },
    },
    required: ["source"],
  },
} as const;
