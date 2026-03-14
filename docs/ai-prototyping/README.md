# AI prototyping in Codespaces

This workflow gives designers a no-local-setup path for turning a Figma file into Storybook prototypes inside this repository.

## 1. Create a Figma API token

1. Open Figma and go to Settings.
2. Create a personal access token.
3. Copy the token value once and keep it private.

## 2. Add Codespaces user secrets

Create these user secrets in GitHub Codespaces before launching the workspace:

- `FIGMA_TOKEN`: your Figma personal access token.
- `FIGMA_FILE`: the Figma file key from the file URL.

The repository reads both values from environment variables. They are not stored in source control.

## 3. Open the Codespace

1. Open this repository in GitHub Codespaces.
2. Wait for the dev container to finish installing dependencies with `pnpm`.
3. Storybook starts automatically in the existing shared-components package and forwards port `6007` for preview.
4. GitHub Copilot Chat auto-registers the workspace Figma MCP server from the dev container configuration.

## 4. Verify the Figma connection

Run this command in the Codespace terminal:

```bash
pnpm figma:connect
```

It validates your token, fetches file metadata, and prints the available frames and components that Copilot can target.

## 5. Generate prototypes with Copilot

Prototype stories live under `packages/shared-components/src/prototypes/ai` and are already included in the current Storybook story glob.

Useful prompt pattern:

```text
Use the Figma MCP tools to inspect frame 12:34 from the current FIGMA_FILE.
Create or update a Storybook story in packages/shared-components/src/prototypes/ai that recreates the layout with existing shared-components first, then Compound Web primitives where needed.
Keep the story title under AI Prototypes.
```

## 6. See prototypes in Storybook

New or updated `*.stories.tsx` files under `packages/shared-components/src/prototypes/ai` appear automatically in Storybook under the `AI Prototypes` section.

Use the guidance files in this directory to help Copilot stay aligned with the existing component system:

- `component-mapping.md`
- `design-tokens.md`
- `storybook-guidelines.md`