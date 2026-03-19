/**
 * Truncation utilities for tool output limits
 * Provides head and tail truncation with continuation hints
 */

// Default limits
export const DEFAULT_MAX_LINES = 2000;
export const DEFAULT_MAX_BYTES = 50 * 1024; // 50KB
export const DEFAULT_LINE_LENGTH_LIMIT = 500;

export interface TruncationResult {
  content: string;
  wasTruncated: boolean;
  truncatedLines?: number;
  truncatedBytes?: number;
  continuationHint?: string;
}

/**
 * Truncate content from the beginning (keep tail)
 * Used for: bash command output (shows end of output)
 */
export function truncateTail(
  content: string,
  maxLines: number = DEFAULT_MAX_LINES,
  maxBytes: number = DEFAULT_MAX_BYTES
): TruncationResult {
  const lines = content.split("\n");
  let wasTruncated = false;
  let truncatedLines = 0;
  let truncatedBytes = 0;

  // Check byte limit first
  const byteLength = Buffer.byteLength(content, "utf-8");
  if (byteLength > maxBytes) {
    // Find how many lines we can keep from the end
    let byteCount = 0;
    let linesToKeep = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(lines[i] + "\n", "utf-8");
      if (byteCount + lineBytes > maxBytes) break;
      byteCount += lineBytes;
      linesToKeep++;
    }

    const keptLines = lines.slice(lines.length - linesToKeep);
    truncatedLines = lines.length - linesToKeep;
    truncatedBytes = byteLength - byteCount;
    wasTruncated = true;

    return {
      content: keptLines.join("\n"),
      wasTruncated,
      truncatedLines,
      truncatedBytes,
      continuationHint: `[...${truncatedLines} lines truncated (${Math.round(truncatedBytes / 1024)}KB)]`,
    };
  }

  // Check line limit
  if (lines.length > maxLines) {
    const keptLines = lines.slice(lines.length - maxLines);
    truncatedLines = lines.length - maxLines;
    wasTruncated = true;

    return {
      content: keptLines.join("\n"),
      wasTruncated,
      truncatedLines,
      continuationHint: `[...${truncatedLines} lines truncated]`,
    };
  }

  return { content, wasTruncated: false };
}

/**
 * Truncate content from the end (keep head)
 * Used for: file reads (shows beginning of file)
 */
export function truncateHead(
  content: string,
  maxLines: number = DEFAULT_MAX_LINES,
  maxBytes: number = DEFAULT_MAX_BYTES
): TruncationResult {
  const lines = content.split("\n");
  let wasTruncated = false;
  let truncatedLines = 0;
  let truncatedBytes = 0;

  // Check byte limit first
  const byteLength = Buffer.byteLength(content, "utf-8");
  if (byteLength > maxBytes) {
    // Find how many lines we can keep from the beginning
    let byteCount = 0;
    let linesToKeep = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineBytes = Buffer.byteLength(lines[i] + "\n", "utf-8");
      if (byteCount + lineBytes > maxBytes) break;
      byteCount += lineBytes;
      linesToKeep++;
    }

    const keptLines = lines.slice(0, linesToKeep);
    truncatedLines = lines.length - linesToKeep;
    truncatedBytes = byteLength - byteCount;
    wasTruncated = true;

    return {
      content: keptLines.join("\n"),
      wasTruncated,
      truncatedLines,
      truncatedBytes,
      continuationHint: `[...${truncatedLines} more lines (${Math.round(truncatedBytes / 1024)}KB), use offset=${linesToKeep + 1} to continue reading]`,
    };
  }

  // Check line limit
  if (lines.length > maxLines) {
    const keptLines = lines.slice(0, maxLines);
    truncatedLines = lines.length - maxLines;
    wasTruncated = true;

    return {
      content: keptLines.join("\n"),
      wasTruncated,
      truncatedLines,
      continuationHint: `[...${truncatedLines} more lines, use offset=${maxLines + 1} to continue reading]`,
    };
  }

  return { content, wasTruncated: false };
}

/**
 * Truncate long lines in content
 * Used for: grep results (keeps lines readable)
 */
export function truncateLongLines(
  content: string,
  maxLineLength: number = DEFAULT_LINE_LENGTH_LIMIT
): { content: string; wasTruncated: boolean } {
  const lines = content.split("\n");
  let wasTruncated = false;

  const truncatedLines = lines.map((line) => {
    if (line.length > maxLineLength) {
      wasTruncated = true;
      return line.substring(0, maxLineLength) + " [...truncated]";
    }
    return line;
  });

  return {
    content: truncatedLines.join("\n"),
    wasTruncated,
  };
}
