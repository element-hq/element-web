# AI Prototypes

Keep AI-generated Storybook experiments in this directory so they are picked up by the existing story glob without mixing them into production component stories.

- Add new `*.stories.tsx` files here or in subfolders beneath this directory.
- Keep titles under the `AI Prototypes/` namespace.
- Prefer composing from `@element-hq/web-shared-components` and `@vector-im/compound-web` instead of adding one-off primitives.
- Treat these stories as disposable prototypes unless they are promoted into a production component folder.