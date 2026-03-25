# AI prototyping in Codespaces

This workflow gives designers a no-local-setup path for turning Figma designs into Storybook prototypes inside this repository. A custom **Designer agent** in Copilot Chat handles Figma URL parsing, connection validation, and story generation automatically.

## 1. Create a Figma API token

1. Open Figma and go to Settings → Security → Personal access tokens.
2. Generate a new token and copy it immediately (Figma only shows it once).

## 2. Add the Codespace secret

Create **one** user secret in GitHub Codespaces before launching the workspace:

- `FIGMA_TOKEN`: your Figma personal access token.

Go to [GitHub → Settings → Codespaces → Secrets](https://github.com/settings/codespaces), add `FIGMA_TOKEN`, and allow the `element-hq/element-web` repository.

> **No per-file secret needed.** The Designer agent extracts the file key from whatever Figma URL you paste in chat. You can work with any Figma file using the same token.

## 3. Open the Codespace

1. Open this repository in GitHub Codespaces.
2. Wait for the dev container to finish installing dependencies with `pnpm`.
3. Storybook starts automatically in the existing shared-components package and forwards port `6007` for preview.
4. Element Web can also be started for in-app prototyping (see below).
5. The Figma MCP server registers automatically from the dev container configuration.

## 4. Use the Designer agent

Open Copilot Chat (⌘⇧I on Mac · Ctrl+Shift+I on Windows/Linux) and select **@designer** from the agent picker. Paste any Figma URL and describe what you want:

```text
@designer Here's my design: https://www.figma.com/design/AbCdEfGhIjK/My-File?node-id=12-34
Please create a Storybook prototype of the main screen.
```

The agent will:
- Extract the file ID and node ID from the URL
- Validate the connection (and guide you through setup if the token isn't configured)
- Inspect the Figma file structure
- Generate a Storybook story using existing shared-components and Compound Web primitives

No need to run `pnpm figma:connect` manually — the agent handles validation itself.

## 5. See prototypes in Storybook

New or updated `*.stories.tsx` files under `packages/shared-components/src/prototypes/ai` appear automatically in Storybook under the `AI Prototypes` section.

## 6. Prototype inside Element Web

For designs that need to be seen in the context of the full app (navigation, theming, surrounding UI):

1. Ask `@designer` to prototype in Element Web (e.g., "prototype this in the app").
2. The agent will start Element Web if it isn't running yet (`pnpm run start:element-web`).
3. Element Web is forwarded on port `8080` — open it from the Ports tab.
4. The agent will modify components under `apps/web/src/components/` to match the Figma design.

## Reference

Use the guidance files in this directory to help Copilot stay aligned with the existing component system:

- `design-tokens.md`
- `storybook-guidelines.md`