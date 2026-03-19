Goal
The user is building their own AI agent called "HarunAI" (harun-ai-0.1) and wants to enhance it with features from a reference project called "coding-agent" (a lightweight coding agent). The user has been incrementally implementing features from coding-agent into harun-ai-0.1.
Instructions
- Implement features from coding-agent into harun-ai-0.1 incrementally
- Prioritize Session Management as the first feature
- Improve TUI to match Pi's quality
- Implement Context Compaction for long-running conversations
- Replace existing HarunAI tools with Pi's tools
- Fix tool loading issues - use direct static imports instead of dynamic file system loading
Discoveries
1. Session Management - Implemented successfully with JSONL persistence, branching support, and auto-save
2. TUI Improvements - Created Footer with stats, proper component hierarchy, message boxes with styling
3. Streaming Duplication Bug - Fixed by detecting cumulative vs delta text updates and preventing re-adding duplicates
4. Context Compaction - Implemented token estimation, compaction engine, file operations tracking, and auto-compaction
5. Tool Migration - Created Pi-style tools (read, write, edit, bash, find, grep, ls) in src/core/tools/
6. Tool Loading Bug - Current issue: tools are being loaded dynamically via createTools() which uses process.cwd() path resolution, causing "Tool handler missing" errors
Accomplished
Completed:
- ✅ Session Management with JSONL persistence
- ✅ TUI with proper component hierarchy
- ✅ Footer with context usage percentage
- ✅ Context Compaction system
- ✅ Created Pi-style tools: read, write, edit, bash, find, grep, ls
- ✅ Updated agents to use new tool names
- ✅ Fixed streaming duplication bug
In Progress:
- Fixing tool loading to use static imports instead of dynamic file system loading
Remaining:
- Replace createTools() dynamic loading with static imports
- Ensure both registry (specs) and runtime (handlers) work correctly
Relevant Files
Files Modified/Created:
Session Management:
- /src/session/types.ts - Session types with CompactionEntry
- /src/session/manager.ts - Session CRUD with compaction methods
- /src/session/compaction/ - Token estimation, config, file-ops, engine
TUI:
- /src/tui/index.ts - Main TUI with component hierarchy, streaming, footer
- /src/tui/components/ - Footer, messages, smart-editor, keybindings, session-tree
Tools (NEW Pi-style):
- /src/core/tools/read/index.ts - Read with image support, pagination
- /src/core/tools/write/index.ts - Write with auto directory creation
- /src/core/tools/edit/index.ts - Edit with fuzzy matching
- /src/core/tools/bash/index.ts - Bash command execution
- /src/core/tools/find/index.ts - Glob-based file finding
- /src/core/tools/grep/index.ts - Ripgrep with context
- /src/core/tools/ls/index.ts - Directory listing
- /src/core/tools/utils/truncate.ts - Output truncation
- /src/core/tools/utils/path-utils.ts - Path normalization
Configuration:
- /config/agents/assistant.md - Updated tool references
- /config/agents/planner.md - Updated tool references
- /config/agents/proposal_agent.md - Fixed write_markdown → write
- /config/settings.json - Compaction config
Key Files Needing Fix:
Tool Loading Architecture (THE ISSUE):
1. /src/registry/default-registry.ts - Registers tool specs via r.registerTool() (this works ✅)
2. /src/core/tools/index.ts - createTools() dynamically scans file system (CAUSING BUGS ❌)
3. /src/core/runtime/tools.ts - Uses createTools() to get handlers
The Fix Needed:
Replace the dynamic file system scanning in /src/core/tools/index.ts with static imports:
// INSTEAD OF scanning process.cwd() + "/tools"
import { readToolHandler } from "./read/index.ts";
import { writeToolHandler } from "./write/index.ts";
// ... etc
export function createTools(deps): Record<string, ToolHandler> {
  return {
    read: readToolHandler,
    write: writeToolHandler,
    // ... all 9 tools
  };
}
User Preferences:
1. Keep existing render_pdf and send_telegram tools
2. Remove old dynamic loading code entirely
3. Include tools: read, write, edit, bash, find, grep, ls (9 tools total)
