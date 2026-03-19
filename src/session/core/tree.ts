/**
 * Session core - Tree operations
 */

import type { SessionEntry, SessionTreeNode } from "../types";

/** Build the session as a tree structure */
export function buildTree(
  entries: SessionEntry[],
  labelsById: Map<string, string>
): SessionTreeNode[] {
  const nodeMap = new Map<string, SessionTreeNode>();
  const roots: SessionTreeNode[] = [];

  // Create nodes with resolved labels
  for (const entry of entries) {
    const label = labelsById.get(entry.id);
    nodeMap.set(entry.id, { entry, children: [], label });
  }

  // Build tree
  for (const entry of entries) {
    const node = nodeMap.get(entry.id)!;
    if (entry.parentId === null || entry.parentId === entry.id) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(entry.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Orphan - treat as root
        roots.push(node);
      }
    }
  }

  // Sort children by timestamp
  const stack: SessionTreeNode[] = [...roots];
  while (stack.length > 0) {
    const node = stack.pop()!;
    node.children.sort((a, b) => a.entry.timestamp - b.entry.timestamp);
    stack.push(...node.children);
  }

  return roots;
}

/** Get all direct children of an entry */
export function getChildren(
  entries: SessionEntry[],
  parentId: string
): SessionEntry[] {
  return entries.filter((e) => e.parentId === parentId);
}

/** Walk from entry to root, returning all entries in path order */
export function getBranchPath(
  entries: SessionEntry[],
  fromId: string | null | undefined,
  byId: Map<string, SessionEntry>
): SessionEntry[] {
  const path: SessionEntry[] = [];
  let current = fromId ? byId.get(fromId) : undefined;
  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}
