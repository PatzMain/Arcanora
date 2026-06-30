---
name: git-workflow
description: Mandatory git commands, commit messaging format, and CONTEXT_HANDOFF.md updates when wrapping up tasks in Arcanora.
---

# Git Workflow & Handoff Rules in Arcanora

To maintain repository clean-up and project synchronization, every finished task must go through the following git workflow:

## 1. Commit Your Changes
After completing any coding task (which passes building, compiling, and testing), run the following commands:

```bash
git add .
git commit -m "<type>: <brief description>"
```

### Commit Message Conventional Prefixes:
- `feat:` for a new feature or game mechanic.
- `fix:` for fixing a bug or spelling error.
- `refactor:` for code restructuring that doesn't change behavior.
- `docs:` for modifying documentation or markdown files.
- `chore:` for updating dependencies or build tasks.

## 2. Update CONTEXT_HANDOFF.md
Immediately after committing, open [CONTEXT_HANDOFF.md](file:///c:/Users/Patz/Desktop/My%20Projects/Arcanora/CONTEXT_HANDOFF.md) and record a summary of what you did under the **"Recent Changes Log"** section. Use the format:

```markdown
### YYYY-MM-DD
- **Feature Name**: Brief 1-2 sentence description of what was changed or added.
- **File Adjustments**: Note which key files were modified/created.
```

This ensures the next developer or agent session can instantly pick up from where you left off.
