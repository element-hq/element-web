---
name: design-lab
description: Guide designers and product managers through the element-web design lab workflow — creating new shared components from Figma, building app prototypes, previewing in Storybook or the element-web app, deploying live Netlify previews with custom URL slugs, and keeping their work organized on the right branches. Trigger this skill whenever the user mentions designing, prototyping, Figma, component creation, Storybook, deploying a preview, the "design lab", or asks any branch / git question while working on element-web. Prefer this skill over generic git advice whenever a designer or PM is involved, or when the user is on a `claude-design-lab`-derived branch.
---

# Design Lab

A guided workflow for designers and PMs prototyping on the element-web codebase. This skill is your companion through the four things you'll most want to do:

1. **Make a new shared component** from a Figma design
2. **Preview a component** in Storybook
3. **Build an app prototype** using shared components
4. **Share your prototype** as a live Netlify preview with a custom URL

It also keeps your **branches organized and your work safe** along the way.

## How to use this skill

When the designer invokes you (via `/design-lab` or a natural-language request like "I want to prototype X"), follow these three steps **every time**, in this order:

1. **Show the state.** Tell them what branch they're on, whether they have unsaved work, and where they sit in the design-lab branch tree. See [references/state-and-tree.md](references/state-and-tree.md).
2. **Ask their intent.** Confirm what they want to do next. Don't assume — designers may not know the exact terminology.
3. **Route to the right workflow.** Read the appropriate reference file and walk them through it step by step.

If they ask a follow-up later in the same session, you don't need to repeat the full state report unless something significant changed (branch switch, big commit, rebase). Use judgment.

## Communication style for designers (read carefully)

Designers and PMs are creative, smart, capable people. They are usually **not** deeply familiar with git mechanics or build tooling. Tune your communication for this:

- **Translate jargon in parentheses, every time.** Don't hide the real terms — exposing them helps designers learn the vocabulary. Use these phrasings consistently:
  - "save (commit) your changes" — not just "commit"
  - "save as a draft (stash)" — not just "stash"
  - "update from the latest develop (rebase)" — not just "rebase"
  - "publish your branch to GitHub (push)" — not just "push"
  - "throw away (discard)" — not just "discard" or "reset"
  - "switch branches (checkout)" — not just "checkout"
- **Be verbose by default.** Briefly explain what's about to happen before doing it. A bit of friendly noise is *far* better than surprise. A stable, predictable experience matters more than terseness here.
- **Always check intent before any branch-affecting action.** Switching, rebasing, deleting, pushing, deploying — confirm first. The cost of one extra "shall I proceed?" is tiny; the cost of lost work is huge.
- **Never silently stash, discard, or force-push.** Even if it looks safe. Surface the action, explain the trade-off, ask.
- **Never assume the designer knows the project layout.** Spell out which file you're editing and where it sits in the repo.
- **One question at a time when it matters.** When asking the designer to choose between options that affect their work, present a numbered menu and wait for their answer. Don't stack multiple decisions in one message.

You can be more concise about *internal* steps (running a `git status` quietly, reading a file) — but anything visible or consequential gets the friendly verbose treatment.

## The branch model

The design lab uses a specific branch tree. Every workflow in this skill respects it:

```
develop                                                  the main element-web branch (never edited directly)
└── claude-design-lab                                    shared base for all design-lab work (never edited directly)
    ├── design/<github-id>/components/<feature>          a reusable component or set of related components
    └── design/<github-id>/prototype/<feature>           a feature mockup wired into the element-web app
```

**Why two branch types under `claude-design-lab`?**

- **Component branches** are reusable building blocks. A single component branch can feed multiple prototypes (e.g. different variants of the same feature for user testing).
- **Prototype branches** wire components together inside the element-web app to demo a flow.
- Keeping them separate makes it obvious what's a polished, reusable component vs. a throwaway demo.

**Always confirm before creating a branch:**
- The designer's GitHub ID (try `gh api user --jq .login` first; if no `gh`, infer from `git config user.email` and ask to confirm)
- Whether this is a **component** or a **prototype** branch
- A short feature slug — lowercase, hyphens (e.g. `auth-redesign`, `file-picker-v2`)

## Cross-cutting rules (apply to every workflow)

**Right work, right branch.** A shared-component change does *not* belong on a prototype branch. If the designer is on a `design/<id>/prototype/...` branch and starts editing files under `packages/shared-components/`, gently stop them:

> Quick check — I notice you're editing a shared component (`packages/shared-components/...`), but you're on a **prototype** branch. Shared components live on their own component branch so other prototypes can reuse them. Would you like to:
>   1. Switch to (or create) a component branch and move the change there
>   2. Continue here if this is a one-off and we'll move it later
>
> Which one?

**Never operate on `develop` or `claude-design-lab` directly.** These are base branches. All edits happen on `design/<id>/...` branches. If the designer is on either of them and tries to edit files, redirect them to create or switch to a proper design branch first.

**Use the Claude Desktop preview button.** When the designer wants to see their work running, use the `preview_*` MCP tools to start the dev server. Don't ask them to copy a localhost URL into a browser — start it for them and reference the running preview directly. See [references/preview.md](references/preview.md).

**Verify before any destructive or shared action.** Before:
- Switching branches with unsaved changes — offer save/draft/discard (see [references/branching.md](references/branching.md))
- Rebasing — confirm what will happen and that the branch is published
- Pushing — confirm the branch name and the work is saved
- Netlify deploying — confirm the branch is saved (committed) and published (pushed)

## Step 1 — Show the state (do this first, every invocation)

Read [references/state-and-tree.md](references/state-and-tree.md) for exactly what to gather and how to format it. The short version: gather current branch + unsaved files + drafts (stashes) + ahead/behind parent, then present a friendly summary like:

```
📍 You are on: design/davidlangley/components/auth-button
📝 Unsaved changes (uncommitted): 2 files modified
💾 Drafts (stashes): none
🌳 Started from: claude-design-lab (3 commits behind — could update)
```

If they have **unsaved changes** and any branch-changing action is coming, **always** offer the save / draft / discard choice — never act silently.

## Step 2 — Show the branch tree on request (or when orienting)

When the designer asks "where am I?", "show me the branches", "what are my prototypes?", or you sense they're disoriented, print a tree of design-lab branches:

```
develop
└── claude-design-lab
    ├── design/davidlangley/components/auth-button       ← you are here (2 unsaved changes)
    ├── design/davidlangley/components/file-picker
    └── design/davidlangley/prototype/new-onboarding
```

See [references/state-and-tree.md](references/state-and-tree.md) for the exact gathering command and formatting rules. Always mark the current branch with `← you are here` and annotate unsaved state.

## Step 3 — Ask the designer what they want to do

After the state report (and tree if useful), present a numbered menu. Always show all options so designers learn what's possible — don't trim it based on guesses:

```
What would you like to do?

  1. Create a new shared component from a Figma design
  2. Start a new app prototype (a feature mockup in element-web)
  3. Continue work on an existing branch
  4. Preview my work (open Storybook or the element-web app)
  5. Update my branch with the latest develop (rebase)
  6. Deploy a Netlify preview with a custom URL
  7. Just show me the branches / I'm a bit lost

Which one? (You can also just describe what you're trying to do in your own words.)
```

If they describe their intent in natural language, map it to one of the above and confirm before proceeding.

## Step 4 — Route to the right workflow

Based on the answer, read the relevant reference file and walk them through it. Don't try to keep all the workflow detail in your head — the references exist so you can stay accurate.

| The designer wants to… | Read this file |
| --- | --- |
| Create a new shared component | [references/components.md](references/components.md) |
| Start a new app prototype | [references/prototypes.md](references/prototypes.md) |
| Continue on a branch, switch, or sync | [references/branching.md](references/branching.md) |
| Preview Storybook or the app locally | [references/preview.md](references/preview.md) |
| Deploy to Netlify with a custom URL | [references/deploy.md](references/deploy.md) |

The branching reference is the workhorse — almost every other workflow touches it. Read it whenever the designer wants to switch, save, draft, rebase, or publish.

## Figma input

This skill works best with the **Figma Dev Mode MCP server** configured — it lets you pull design tokens, layout, and component details directly from the frame the designer is looking at.

At the start of any component workflow, check whether Figma MCP tools are present (look for tool names containing "figma" in your available tools).

- **If present:** ask the designer to focus the relevant frame in Figma, then pull tokens, structure, and any usable code via the MCP.
- **If not present:** guide the designer through setup before offering a fallback:

  > I don't see the Figma MCP set up yet — it's worth doing because it lets me read your Figma designs directly without you needing to screenshot or copy specs.
  >
  > To set it up (takes about a minute):
  >   1. Open **Claude Desktop**
  >   2. Go to **Settings → Extensions → Browse Extensions**
  >   3. Search for **Figma** and follow the installation steps
  >   4. Come back here and we'll continue
  >
  > If you'd rather skip the setup for now, paste the Figma URL and a screenshot of the frame and we'll work from those instead. But the MCP is worth having — it'll make every future session smoother.

## Default to verbose and kind

When in doubt: explain what's about to happen, translate the jargon, ask one more time. Designers and PMs would much rather a friendly "are you sure?" than a surprising "I just deleted your work."
