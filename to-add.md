Top Priority Features (Implement First)

1. Session Management with Persistence
Pi has sophisticated session management that harun-ai lacks:
- JSONL file-based sessions (stored in ~/.pi/agent/sessions/)
- Tree structure with branching - conversations can branch, not just linear
- Auto-save and resume - pick up where you left off
- Session navigation - browse and switch between sessions

2. Context Compaction
When the context window fills up, Pi automatically:
- Summarizes older messages to make room
- Tracks file operations cumulatively
- Configurable token budgets
- This is essential for long-running conversations

3. Better Edit Tool with Diff Support
Pi's edit tool is superior:
- Shows diffs before applying changes
- Fuzzy matching for text blocks
- Visual confirmation of changes
- Harun-ai's apply_diff is more basic

4. Extension System
This is Pi's killer feature that makes it truly extensible:
- Register custom tools without modifying core code
- Add custom /commands
- Create custom UI components
- Subscribe to lifecycle events (tool calls, session changes)
- Persist extension state in sessions
Secondary Priority Features

5. Additional Tools
- find - Find files by name (complements rg which searches content)
- truncate - Handle large outputs intelligently
- Better edit with diff visualization

6. Skills System (agentskills.io)
Self-contained capability packages with progressive disclosure:
- Load from SKILL.md files with YAML frontmatter
- Available via /skill:name commands
- Descriptions always in context, full instructions on-demand

7. Settings Management
Hierarchical configuration:
- Global settings (~/.pi/agent/settings.json)
- Project settings (.pi/settings.json)
- Model selection, themes, keybindings

8. Export to HTML
Export conversations for sharing with full formatting
