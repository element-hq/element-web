# Workflow: Preview locally

Designers should see their work running, not just on disk. This skill always uses the **Claude Desktop preview button** (`preview_*` MCP tools) to start dev servers — never ask the designer to copy localhost URLs into a browser themselves.

The repo has two preview targets, defined in `.claude/launch.json`:

| What | Command | Port |
| --- | --- | --- |
| Shared-components Storybook | `pnpm --filter @element-hq/web-shared-components storybook` | 6007 |
| Element-web app | `pnpm --filter element-web start` | 8080 |

## Pick the right preview

| Designer wants to see… | Use this preview |
| --- | --- |
| A new or modified shared component | Storybook (port 6007) |
| Component states (default, loading, error, etc.) | Storybook |
| A feature mockup inside the app | Element-web (port 8080) |
| The full prototype flow they'd show a stakeholder | Element-web |

If unsure, ask:

> Would you like to see this in **Storybook** (good for inspecting a single component and all its states) or in the **element-web app** (good for seeing the prototype in context)?

## Starting a preview

Always announce what you're starting and roughly why before you press the button:

> Starting **Storybook** so you can see the new `AuthButton` and all its states. This takes a few seconds.

Then call `preview_start` with the relevant config. The MCP picks up the entry from `.claude/launch.json`. Wait for the server to be ready before confirming.

After it's up, use `preview_screenshot` or describe what's rendered so the designer knows it's working:

> Storybook is running. Your new `AuthButton` is at `Auth > AuthButton` in the left sidebar.

## Verifying the change actually shows up

When the designer wants to confirm a change is reflected, use the preview verification workflow:

1. **Reload if needed** (`preview_eval: window.location.reload()`). Skip if HMR is already updating.
2. **Check for errors** with `preview_console_logs` or `preview_logs`.
3. **Snapshot the content** with `preview_snapshot` or `preview_screenshot`.

If something looks off (CSS not applied, blank page, error in console), surface it plainly:

> There's an error in the console: `Cannot find module './AuthButton.module.css'`. Looks like the CSS file is missing. Want me to take a look?

## Stopping a preview

When the designer's done, offer to stop the server cleanly:

> Want me to stop the Storybook server, or leave it running in case you want to come back to it?

Use `preview_stop` if they say yes.

## Switching between Storybook and the app

It's fine to have both running at once if needed (different ports), but mention it:

> I'll start the element-web app on port 8080. Storybook is still running on 6007 — you can switch back and forth.

## Common pitfalls

- **Don't ask the designer to copy localhost URLs.** Use the preview tools.
- **Don't start a server when the change isn't previewable** (e.g. a CSS-Modules type-only change). Just say so:
  > This change is only in the type definitions — there's nothing visual to preview. Want me to run the type-check and tests instead?
- **Watch the console.** If errors appear after a code change, report them — don't claim success without checking.
