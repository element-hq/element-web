# AGENTS.md

Instructions for AI coding agents working in this repository. Humans should read
[CONTRIBUTING.md](./CONTRIBUTING.md) and [code_style.md](./code_style.md) instead — this file summarises those and
adds the things that are easy to get wrong here.

## Repository layout

A pnpm + nx monorepo (`element-web-monorepo`). Workspaces are `apps/*`, `packages/*`, `modules` and `modules/*`.

| Path                                                                                                  | Contents                                                                                                      |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apps/web`                                                                                            | The Element Web app. Also hosts view models (`src/viewmodels/`) and the Playwright e2e suite (`playwright/`). |
| `apps/desktop`                                                                                        | Element Desktop.                                                                                              |
| `packages/shared-components`                                                                          | Published UI component library, `@element-hq/web-shared-components`. New views go here.                       |
| `packages/module-api`, `packages/shared-utils`, `packages/shared-types`, `packages/playwright-common` | Published support packages.                                                                                   |
| `modules/*`                                                                                           | Optional runtime modules (banner, widget toggles, …).                                                         |
| `docs/`                                                                                               | VitePress docs site.                                                                                          |

There is **no** top-level `playwright/` directory; `docs/playwright.md` uses paths relative to `apps/web`.

## Commands

Run from the repo root unless stated otherwise.

| Task                                                   | Command                                           |
| ------------------------------------------------------ | ------------------------------------------------- |
| Full lint (types, format, js, styles, workflows, knip) | `pnpm lint`                                       |
| Format                                                 | `pnpm lint:fmt:fix`                               |
| Lint JS/TS                                             | `pnpm lint:js:fix`                                |
| Typecheck                                              | `pnpm -r --workspace-concurrency=1 lint:types`    |
| All unit tests                                         | `pnpm test:unit`                                  |
| Regenerate i18n strings                                | `pnpm i18n`                                       |
| Start the app                                          | `cd apps/web && pnpm start`                       |
| Storybook                                              | `cd packages/shared-components && pnpm storybook` |

Formatting is **oxfmt** and linting is **oxlint**. This repo does not use prettier or eslint — running prettier here
reformats files against the project style and reports failures that do not exist.

Run `pnpm i18n` after adding or changing any translated string.

## Running unit tests

Both jest and vitest are in use; a migration to vitest is in progress. **The file path decides the runner.**

| Test file                                      | Runner           | Command                                                     |
| ---------------------------------------------- | ---------------- | ----------------------------------------------------------- |
| `apps/web/test/**/*-test.[tj]s?(x)`            | jest             | `cd apps/web && pnpm jest <path>`                           |
| `apps/web/src/**/*.test.{ts,tsx}`              | vitest           | `pnpm vitest run <path>`                                    |
| `apps/web/src/**/*.test.browser.{ts,tsx}`      | vitest (browser) | `pnpm vitest run --project web-browser <path>`              |
| `packages/shared-components/src/**/*.test.tsx` | vitest           | `cd packages/shared-components && pnpm test:unit -- <path>` |

Notes:

- Write new tests as co-located vitest `*.test.ts(x)` next to the source file. The `apps/web/test/` jest tree is
  legacy; extend it only when the file you are changing already lives there.
- Vitest runs with `globals: false`, so import `describe`, `it`, `expect` and friends explicitly.
- `packages/shared-components` is excluded from the root vitest config and must be run from its own directory.
- "No test files found" means you picked the wrong runner or path. It is not a pass.
- Prefer extending an existing test over adding a new file when covering a close variant of existing behaviour.

## Running e2e tests

Specs live in `apps/web/playwright/e2e`. See [docs/playwright.md](./docs/playwright.md) for the full guide.

```sh
cd apps/web && pnpm test:playwright -- playwright/e2e/<spec>.spec.ts --project=Chrome
```

- Requires a container runtime (Docker/Podman/Colima) for the homeserver testcontainers.
- On macOS, add `--ignore-snapshots`. Screenshot baselines are only committed for Linux, so comparisons fail locally.
- Never run `pnpm test:playwright:screenshots` locally to "fix" a screenshot diff — it writes host-rendered baselines.
  Screenshots are updated in the Docker environment, which CI matches.
- The config uses `reuseExistingServer: true`. Check `lsof -ti:8080` first; a stale dev server silently serves the
  tests. Port-bind errors are an infrastructure problem, not a test failure.
- Locate elements by role, label and accessible name, not CSS classes.
- Tag any test using `toMatchScreenshot` with `@screenshot`.

### Reviewing updated screenshots

Updated baselines are part of the diff and must be reviewed, not accepted blindly. Before committing any changed
`.png` under `apps/web/playwright/snapshots/` or `packages/shared-components/__vis__/`:

- Look at the image. Confirm every visible difference is one your change was meant to produce.
- Treat anything else as a regression until proven otherwise: shifted or clipped layout, changed spacing or font,
  missing or duplicated elements, a wrong theme, an untranslated or placeholder string, a loading or error state
  captured instead of the real content.
- Unrelated files changing baselines is a signal in itself — if a screenshot moved for a component you did not
  touch, find out why rather than committing it.
- Never regenerate baselines to make a failing test pass. A diff you cannot explain is a bug in the change.

## Writing UI code: MVVM

New UI follows MVVM. Full details in [docs/MVVM.md](./docs/MVVM.md); the shape for a feature `Foo`:

**View** — `packages/shared-components/src/<domain>/FooView/` containing `FooView.tsx`, `FooView.module.css`,
`FooView.test.tsx`, `FooView.stories.tsx` and `index.ts`. The view declares the contract:

```tsx
export interface FooViewSnapshot { title: string }
interface FooViewActions { setTitle: (title: string) => void }
export type FooViewModel = ViewModel<FooViewSnapshot, FooViewActions>;

export function FooView({ vm }: { vm: FooViewModel }): JSX.Element {
    const { title } = useViewModel(vm);
    ...
}
```

Views are dumb: they read the snapshot and call actions, nothing else. Develop them in Storybook.

**ViewModel** — `apps/web/src/viewmodels/<domain>/FooViewModel.ts`, a class extending `BaseViewModel` that implements
the interface from the view. `apps/web/src/components/viewmodels/` is the deprecated v1 location; do not add there.

Rules that are easy to miss:

- Define actions as arrow-function class properties (`public doThing = (): void => {}`) so `this` survives being
  passed as a callback.
- Use `this.snapshot.merge({ field })` for partial updates. `merge` already skips emitting when nothing changed, so
  do not add equality guards around it, and do not recompute the whole snapshot for one field.
- Track listeners and sub-view-models with `this.disposables.trackListener(...)` / `this.disposables.track(...)`.
- A non-MVVM function component owning a view model should create it with `useCreateAutoDisposedViewModel`; a class
  component creates it in `componentDidMount` and disposes it in `componentWillUnmount`.

Reference implementation: `packages/shared-components/src/room-list/RoomListSearchView/` with
`apps/web/src/viewmodels/room-list/RoomListSearchViewModel.ts`.

## Code style

Read [code_style.md](./code_style.md). The points most often missed:

- **Every new file needs a copyright header**, enforced by oxlint (`element-call/copyright-header`). Lint fails
  without it. Substitute the actual current year — check it rather than copying a year from another file — and leave
  headers on existing files alone:

    ```
    /*
    Copyright <current year> <copyright holder>

    SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
    Please see LICENSE in the repository root for full details.
    */
    ```

    The holder is `Element Creations Ltd.` **only for contributions made as part of Element**. An external
    contributor puts their own name or their company's there instead. Note that `oxlint --fix` inserts the Element
    line unconditionally, so external contributors should write the header by hand and check what the autofix added.

- TypeScript only, named exports only — avoid `export default`.
- 4-space indent, 120-column limit, double quotes, semicolons.
- Declare member visibility (`public`/`private`/`protected`) on class members.
- Avoid `any`; if unavoidable, comment why.
- Roughly one interface, class or enum per file, named after the file.
- Never mix cosmetic and functional changes.
- **Styles:** `apps/web` uses PostCSS (`res/css/**/_Component.pcss`, `mx_`-prefixed classes).
  `packages/shared-components` uses CSS modules (`Component.module.css`, semantic camelCase class names, no `mx_`
  prefix) imported as `styles`. Use Compound design tokens (`var(--cpd-color-…)`, `var(--cpd-space-…)`) for all values.
- Prefer Compound typography components over raw text elements, and `Flex`/`Box` from shared-components over raw
  flexbox markup.

## Comments

Keep comments short and relevant.

- Add TSDoc to exported types, functions, classes and components. Document a component's props.
- Inside a function, explain _why_, not line by line. Add a short overview before a non-obvious block.
- Use plain language matching the identifiers around the comment — no metaphors or CS jargon.
- When changing code, update the comments around it so they stay accurate.
- Any intentionally suppressed lint or type rule needs a nearby comment explaining why.

## Tests are required

- Every change needs unit tests, including features behind labs flags.
- New user-facing features need a "happy path" Playwright e2e test before leaving labs.
- Aim for ≥80% coverage on the diff; CI checks this. There is no `coverage` script at the root — generate the
  reports in the workspaces you touched, then compare from the root:

    ```sh
    pnpm test:unit --coverage                              # vitest, writes coverage/lcov.info
    cd apps/web && pnpm coverage                           # jest only, writes apps/web/coverage/lcov.info
    cd packages/shared-components && pnpm coverage
    pnpm coverage:diff                                     # from the root, needs diff_cover installed
    ```

## Commits

- Split the work into logically separate commits: one concern per commit. Keep refactors, formatting and behaviour
  changes in separate commits.
- Short imperative subject line, no conventional-commit prefix (`feat:`, `fix:`, …).
- Add a body only when it says something the diff does not; keep it to a line or two.

## Pull requests

- The PR title becomes the changelog entry. Write it from the user's point of view and descriptively —
  "Fix bug where cows had five legs", not "Update file.ts". No issue number in the title.
- Keep the description short and relevant: what changed and why, `Fixes #NNN` for the issue, and a brief testing
  strategy. Put explanations of _how_ the code works in code comments, not the description.
- **State in the description that the PR was generated with AI.**
- Add screenshots for visual changes.
- Apply the right type label: `T-Enhancement` (minor bump), `T-Defect` (bug fix), or `T-Task` for changes with no
  user-facing effect — a `T-Task` gets no changelog entry. Add `X-Breaking-Change` for a breaking change.
- Never force-push to a PR branch; the project squash-merges.
