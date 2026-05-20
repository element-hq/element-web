# State report and branch tree

Every time the design-lab skill is invoked, start by gathering and presenting the current state. This grounds the designer in where they are and what's safe to do next.

## Gathering the state

Run these commands (quietly — no need to narrate each one):

```bash
git rev-parse --abbrev-ref HEAD                                # current branch
git status --porcelain                                         # unsaved files (modified, untracked)
git stash list                                                 # drafts on the stash stack
git rev-list --left-right --count <parent>...HEAD              # ahead/behind parent
```

**Determining the parent branch for a design branch:**

- For `design/<id>/components/<slug>` or `design/<id>/prototype/<slug>`: parent is `claude-design-lab`.
- For `claude-design-lab`: parent is `develop`.
- For anything else (e.g. the user is on `develop` itself, or some unrelated branch): no design-lab parent — just report the branch, and gently note that they're not on a design-lab branch yet.

## Presenting the state

Format it as a friendly summary with emoji bullets. Keep it scannable — designers should be able to glance and know what's going on. Always include the parenthetical translation of any git term.

```
📍 You are on: design/davidlangley/components/auth-button
📝 Unsaved changes (uncommitted): 2 files modified, 1 new file
💾 Drafts (stashes): 1 — "WIP: hover state"
🌳 Started from: claude-design-lab (3 commits behind — there are updates you could pull in)
```

**Rules for the summary:**

- If there are no unsaved changes, say so: `📝 Unsaved changes: none — everything is saved (committed)`.
- If there are no drafts, say `💾 Drafts (stashes): none`.
- If the branch is up-to-date with its parent, say `🌳 Started from: claude-design-lab (up to date)`.
- If the designer is on a base branch (`develop` or `claude-design-lab`), say so clearly and remind them they shouldn't edit files directly there:

  > 📍 You are on **claude-design-lab**, which is a base branch — we don't edit files here directly. Any work should go on a `design/<your-id>/components/...` or `design/<your-id>/prototype/...` branch off of this one. Want me to help you create one?

## The branch tree

When the designer asks "where am I?", "show me the branches", or they seem disoriented, print a tree of the design-lab branches.

**Gathering data:**

```bash
git for-each-ref --format='%(refname:short)' refs/heads/ | grep -E '^(claude-design-lab|design/)' | sort
git rev-parse --abbrev-ref HEAD
```

**Rendering rules:**

- Top of tree is always `develop` → `claude-design-lab`.
- Underneath `claude-design-lab`, list all `design/<id>/...` branches sorted alphabetically.
- Group by GitHub ID where there are multiple designers.
- Mark the current branch with `← you are here`.
- Annotate the current branch with unsaved state if any (e.g. `(2 unsaved changes)`, `(1 draft)`).
- If a branch is behind its parent by 5+ commits, append `(5+ commits behind — could update)`.

**Example output:**

```
develop
└── claude-design-lab
    ├── design/davidlangley/components/auth-button          ← you are here (2 unsaved changes)
    ├── design/davidlangley/components/file-picker
    ├── design/davidlangley/prototype/new-onboarding        (8 commits behind — could update)
    └── design/midhun/components/global-search
```

If there are no `design/...` branches yet, show only `develop → claude-design-lab` and offer to help create the first one.

## When to show the state vs. the tree

| Situation | What to show |
| --- | --- |
| Skill is invoked (first time this session) | State summary + intent menu |
| Designer asks "where am I" or "what's the state" | State summary |
| Designer asks "show branches" / "what's everyone working on" | Tree |
| Designer about to switch branches or rebase | State summary first (so unsaved changes get handled) |
| Repeated invocations in the same session, no big changes | Skip the full report; just answer the question |

Use judgment — the goal is to keep the designer oriented without becoming repetitive.
