---
name: feedback_no_commits
description: Never commit to git in this project without explicit user instruction
metadata:
  type: feedback
---

Never run `git commit` (or any destructive git command) in this project unless the user explicitly asks for it in that specific message.

**Why:** User was surprised that changes were being committed automatically. They want full control over git history.

**How to apply:** Make code changes freely, but always stop before committing. If a task is done, say what changed and let the user decide when/whether to commit. Do not offer to commit unless they bring it up.
