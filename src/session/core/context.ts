/**
 * Session utilities - Build context for LLM
 */

import type {
  SessionEntry,
  SessionContext,
  SessionMessageEntry,
  CompactionEntry,
  BranchSummaryEntry,
} from "../types";

/** Build session context from entries (what gets sent to LLM) */
export function buildSessionContext(
  entries: SessionEntry[],
  leafId?: string | null,
  byId?: Map<string, SessionEntry>
): SessionContext {
  // Build id index if not available
  if (!byId) {
    byId = new Map<string, SessionEntry>();
    for (const entry of entries) {
      byId.set(entry.id, entry);
    }
  }

  // Find leaf
  let leaf: SessionEntry | undefined;
  if (leafId === null) {
    // Explicitly null - return no messages (navigated to before first entry)
    return { messages: [], thinkingLevel: "off", model: null };
  }
  if (leafId) {
    leaf = byId.get(leafId);
  }
  if (!leaf) {
    // Fallback to last entry
    leaf = entries[entries.length - 1];
  }

  if (!leaf) {
    return { messages: [], thinkingLevel: "off", model: null };
  }

  // Walk from leaf to root, collecting path
  const path: SessionEntry[] = [];
  let current: SessionEntry | undefined = leaf;
  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  // Extract settings
  let thinkingLevel = "off";
  let model: { provider: string; modelId: string } | null = null;
  let compaction: CompactionEntry | null = null;

  for (const entry of path) {
    if (entry.type === "thinking_level_change") {
      thinkingLevel = entry.thinkingLevel;
    } else if (entry.type === "model_change") {
      model = { provider: entry.provider, modelId: entry.modelId };
    } else if (entry.type === "message" && entry.message.role === "assistant") {
      if (entry.message.provider && entry.message.model) {
        model = { provider: entry.message.provider, modelId: entry.message.model };
      }
    } else if (entry.type === "compaction") {
      compaction = entry as CompactionEntry;
    }
  }

  // Build messages
  const messages: SessionContext["messages"] = [];

  const appendMessage = (entry: SessionEntry) => {
    if (entry.type === "message") {
      messages.push({
        role: entry.message.role,
        content: entry.message.content,
        toolName: entry.message.toolName,
        agentName: entry.message.agentName,
      });
    } else if (entry.type === "custom_message") {
      messages.push({
        role: "custom",
        content: entry.content,
      });
    } else if (entry.type === "branch_summary") {
      const bs = entry as BranchSummaryEntry;
      if (bs.metadata?.summary) {
        messages.push({
          role: "system",
          content: `[Branch summary] ${bs.metadata.summary}`,
        });
      }
    }
  };

  if (compaction) {
    // Emit summary first
    messages.push({
      role: "system",
      content: `[Context summary] ${compaction.content}`,
    });

    // Find compaction index in path
    const compactionIdx = path.findIndex(
      (e) => e.type === "compaction" && e.id === compaction!.id
    );

    // Emit kept messages (before compaction, starting from firstKeptEntryId)
    let foundFirstKept = false;
    for (let i = 0; i < compactionIdx; i++) {
      const entry = path[i];
      if (entry.id === compaction.metadata.firstKeptEntryId) {
        foundFirstKept = true;
      }
      if (foundFirstKept) {
        appendMessage(entry);
      }
    }

    // Emit messages after compaction
    for (let i = compactionIdx + 1; i < path.length; i++) {
      const entry = path[i];
      appendMessage(entry);
    }
  } else {
    // No compaction - emit all messages
    for (const entry of path) {
      appendMessage(entry);
    }
  }

  return { messages, thinkingLevel, model };
}
