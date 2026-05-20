# Workflow: Preview locally

Designers should see their work running, not just on disk. Both dev servers (Storybook and element-web) are managed through Claude Desktop's **server management menu** — the designer doesn't need to run terminal commands themselves.

## How servers are managed in Claude Desktop

Claude Desktop shows a **Servers** panel (accessible from the toolbar) that lists the configured dev servers from `.claude/launch.json`. The designer can start and stop each server with a single click:

```
Servers
  ⊟  element-web                    ✓  [Stop]
  ⊟  shared-components-storyb...       [Stop]
  ⊘  Stop all servers
```

When a server is running, a checkmark appears next to it. The URL is shown as a tooltip (e.g. `localhost:8080` or `localhost:6007`).

When you need the designer to start a server, tell them to use this menu rather than running a command. Example:

> To see your changes, start the **element-web** server from the Servers panel in Claude Desktop (the small toolbar icon), then open **http://localhost:8080** in your browser.

## Pick the right preview

| Designer wants to see… | Use this preview |
| --- | --- |
| A new or modified shared component | Storybook — open `http://localhost:6007` in browser |
| Component states (default, loading, error, etc.) | Storybook — open `http://localhost:6007` in browser |
| A feature mockup inside the app | Element-web — open `http://localhost:8080` in browser |
| The full prototype flow to show a stakeholder | Element-web — open `http://localhost:8080` in browser |

**Always open in an external browser.** The element-web app doesn't work reliably in Claude Desktop's embedded preview. Storybook also works better in a full browser. The standard instruction is:

> Start the server from the **Servers menu** in Claude Desktop, then open **http://localhost:8080** (or **:6007** for Storybook) in your browser.

## Starting a server

Announce what you're starting and why before asking the designer to do it:

> To see the new `AuthButton` component and all its states, start **shared-components-storybook** from the Servers panel, then open **http://localhost:6007** in your browser. Navigate to **Auth > AuthButton** in the Storybook sidebar.

For element-web:

> To see your prototype running, start **element-web** from the Servers panel, then open **http://localhost:8080** in your browser.

If the server is already running (shown with a checkmark in the panel), just direct them to the URL — no need to restart.

## Verifying changes appear

After the designer opens the browser, help them confirm the change is visible:

- **Storybook:** tell them which sidebar path to navigate to (e.g. `Auth > AuthButton > Loading`).
- **Element-web:** tell them the specific screen or flow to reach (e.g. "Sign in, then open a room — the new button should appear in the top bar").

If they say something looks wrong, use `preview_console_logs` or `preview_logs` (for the embedded preview tools, if active) to check for errors, or ask them to copy any red error messages from the browser console.

## Stopping a server

The designer can stop servers from the same Servers panel. Offer a reminder when they're done:

> When you're finished, you can stop the servers from the **Servers panel** to free up resources.

Don't stop servers on the designer's behalf during a session — they may want to keep them running to check things. Only mention stopping if the session is wrapping up.

## Switching between Storybook and element-web

Both can run simultaneously on different ports. If both are running:

> Both servers are running — Storybook is at **http://localhost:6007** and element-web is at **http://localhost:8080**. Open whichever you want to check.

## Common pitfalls

- **Don't use the embedded Claude Desktop preview browser for element-web.** It doesn't work reliably. Always open in an external browser.
- **Don't ask the designer to run terminal commands** to start servers — direct them to the Servers panel instead.
- **If a port is already in use**, the server will fail to start. Tell the designer to check the Servers panel for a server that's already running on that port and stop it first, or restart Claude Desktop.
- **Don't claim something looks correct without the designer checking.** The preview tools can't substitute for the designer's own eyes on the final UI.
