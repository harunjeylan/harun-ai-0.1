/**
 * Session utilities - ID generation
 */

import { randomUUID } from "crypto";

/** Generate a unique short ID (8 hex chars, collision-checked) */
export function generateId(byId: { has(id: string): boolean }): string {
  for (let i = 0; i < 100; i++) {
    const id = randomUUID().slice(0, 8);
    if (!byId.has(id)) return id;
  }
  // Fallback to full UUID if somehow we have collisions
  return randomUUID();
}
