# Storybook guidelines

Follow these rules when generating prototype stories for this repository.

## Placement

- Put experimental prototype stories in `packages/shared-components/src/prototypes/ai`.
- Keep the existing Storybook instance. Do not add another `.storybook` directory or another Storybook package.

## Naming

- Use filenames that end in `.stories.tsx` so the current Storybook config picks them up.
- Keep story titles under the `AI Prototypes/` namespace.

## Composition

- Import existing components from the local shared-components package first.
- Use `@vector-im/compound-web` only when the package does not already expose an equivalent higher-level component.
- Prefer a small number of well-named stories over one huge catch-all story.

## Prototype quality bar

- Mirror the Figma frame hierarchy with readable sections.
- Keep layout tokens explicit so Copilot can iterate predictably.
- Make prototype-only assumptions obvious inside the story content, not in production components.

## Promotion path

- If a prototype becomes product code, move it out of `src/prototypes/ai` and into the relevant component folder.
- Replace exploratory mock content with typed props or view-model-backed stories before promotion.