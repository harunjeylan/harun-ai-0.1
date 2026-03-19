/**
 * Session constants
 */

import { join } from "path";
import { homedir } from "os";

export const SESSIONS_DIR = join(homedir(), ".harunai", "sessions");
export const SESSION_EXTENSION = ".jsonl";
export const CURRENT_SESSION_VERSION = 2;
