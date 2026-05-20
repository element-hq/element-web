# Workflow: Create a new shared component

Use this workflow when the designer wants to build a new component in the `@element-hq/web-shared-components` package, based on a Figma design (or freehand if no Figma yet).

## Branch first

Before writing any code, get the designer onto a **component** branch:

```
design/<github-id>/components/<slug>
```

If they're not on one, run the "Creating a new design branch" flow in [branching.md](branching.md). The branch should be created off `claude-design-lab` (after pulling the latest).

If they're already on a *prototype* branch and trying to add a component — stop and redirect. Components belong on component branches so other prototypes can use them.

## Where components live

```
packages/shared-components/src/
├── core/               general-purpose: avatars, hooks, utils, virtualized lists, pill inputs, roving focus
├── room/               room-related UI
├── room-list/          room list specifically
├── menus/              menu primitives
├── rich-list/          rich list views
├── resize/             resize handles
├── audio/              audio
├── crypto/             crypto / verification
└── i18n/               internationalization helpers
```

**Pick the closest existing domain.** Ask the designer to describe what the component is for, suggest a folder, and confirm. If it truly doesn't fit anywhere, default to `core/`.

## File layout (one component = one folder)

Every component is its own folder. Match the existing convention exactly — designers and other devs rely on the consistency.

**Regular component:**

```
MyComponent/
├── MyComponent.tsx              the React component
├── MyComponent.module.css       CSS Modules — co-located styles
├── MyComponent.stories.tsx      Storybook stories (one per visible state)
├── MyComponent.test.tsx         unit tests
└── index.tsx                    re-export to make imports clean
```

**MVVM component** — same layout, but the View suffix is in the file names:

```
MyComponentView/
├── MyComponentView.tsx
├── MyComponentView.module.css
├── MyComponentView.stories.tsx
├── MyComponentView.test.tsx
└── index.tsx
```

**Before writing**, always **read an existing similar component first** and mirror its structure:

- Simple regular-component reference: `packages/shared-components/src/core/AvatarWithDetails/`
- For MVVM, find an existing `*View` folder in the closest domain (e.g. `packages/shared-components/src/room-list/RoomListSearchView/` if present, or scan `src/room-list/` for one).

The README at `packages/shared-components/README.md` is the source of truth for conventions — when in doubt, defer to it. The MVVM doc lives at `docs/MVVM.md`.

## Regular vs MVVM — which one?

- **Regular** by default. Suitable when the component takes props in and renders — no internal async state, no derived state from external sources.
- **MVVM** when the component needs to manage non-trivial state, react to async events, or hide complexity behind a clean view interface. The view receives a `vm` prop (a ViewModel instance) and renders from its snapshot.

If unsure, ask the designer briefly what the component needs to *do*, then suggest one and explain why.

## Pulling design data from Figma

**With the Figma MCP available** (the Dev Mode MCP server):

- Ask the designer to **focus the relevant frame** in Figma.
- Use the MCP to pull the frame's structure, design tokens, layout, and any code snippets.
- Cross-reference against Compound Design System primitives — **prefer using `@vector-im/compound-web` components and tokens wherever possible** rather than reimplementing them.

**Without the Figma MCP:**

> No problem — could you paste the Figma URL for the frame, and (if easy) drop in a screenshot? I'll work from those.

Get:
- The Figma URL (with `node-id` if available — appears in the URL after `?node-id=...`)
- A screenshot of the frame
- The states the component should support (default, hover, disabled, loading, error, empty, etc. — ask explicitly)

## Writing the component

1. **Open and read** the reference component (see above) before writing. Mirror its imports, naming, and file structure.
2. **Use Compound primitives** from `@vector-im/compound-web` wherever you can — buttons, inputs, icons, tokens, layout helpers. Don't reimplement.
3. **CSS Modules only.** Import as `import styles from "./MyComponent.module.css"` and reference classes as `styles.foo`. No inline styles.
4. **Strong types.** Define explicit prop types (`type MyComponentProps = { … }`) and export them so consumers can extend.
5. **For MVVM:** define `MyComponentViewSnapshot` (state shape) and `MyComponentViewActions` (callback shape) separately. The view reads from `vm.snapshot` and calls `vm.actions.xxx`.
6. **Export from `src/index.ts`** so the app and other packages can import it: `export { MyComponent } from "./core/MyComponent";`.
7. **i18n:** if the component has user-visible strings, use `useI18n()` — never hard-code text.

After writing, suggest a save (commit) checkpoint:

> The component file is in place. Shall I save (commit) this as a checkpoint before we add stories?

## Writing stories (one per visible state)

Every component must have a `.stories.tsx` file. The story acts as the component's spec — designers verify their work in Storybook against these stories.

**Story title:** shallow and browse-oriented. Examples: `Auth/AuthButton`, `RoomList/RoomListSearchView`. Do *not* mirror the full source path.

**One named story per visible state:**

```tsx
export const Default: Story = {};
export const Loading: Story = { args: { isLoading: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Error: Story = { args: { error: "Network failed" } };
export const Empty: Story = { args: { items: [] } };
```

Ask the designer: **"What states should this component support?"** Make sure every state in the Figma has a corresponding story.

**Link the Figma design** in `parameters` so designers can hop between Storybook and the design in one click:

```tsx
const meta = {
    title: "Auth/AuthButton",
    component: AuthButton,
    tags: ["autodocs"],
    args: {
        label: "Continue",
        onClick: fn(),
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/.../auth-flow?node-id=12-345",
        },
    },
} satisfies Meta<typeof AuthButton>;

export default meta;
type Story = StoryObj<typeof meta>;
```

**Important:** the meta must use `satisfies Meta<…>` — not `as Meta<…>` or `: Meta<…> =`. Type assertions break Storybook's docgen and the ArgTypes table won't populate. See `packages/shared-components/README.md` for the full conventions, including the MVVM story wrapper pattern (`useMockedViewModel` + `withViewDocs`).

## Tests

Add a `MyComponent.test.tsx` with at least:
- Renders without crashing with default props.
- Reflects the key visible-state props (e.g. shows the loading indicator when `isLoading`).

Use Vitest + React Testing Library. Mirror the structure of the reference component's test file.

```bash
pnpm --filter @element-hq/web-shared-components test:unit
```

Visual regression tests run automatically from the stories — you don't need to write extra ones, but be aware:

```bash
pnpm --filter @element-hq/web-shared-components test:storybook:update    # refresh baselines if visuals changed intentionally
```

## Verifying in Storybook

Once the stories exist, start Storybook via the Claude Desktop preview button (port **6007**) so the designer can see their work:

```bash
pnpm --filter @element-hq/web-shared-components storybook
```

See [preview.md](preview.md) for how to start the preview cleanly.

After they confirm it looks right, offer to save (commit) the work and publish (push) the branch.

## Common pitfalls

- **Story titles must be shallow.** `Auth/AuthButton`, not `Components/Auth/AuthButton`.
- **`satisfies Meta`** — not `as` or `:`. Type assertions silently break docgen.
- **Don't reimplement Compound primitives.** Use `@vector-im/compound-web`.
- **No inline styles.** CSS Modules only.
- **Match the existing folder naming** — `MyComponent/` or `MyComponentView/`, not `my-component/`.
- **One story per visible state**, not one giant story with knobs.
- **Don't add the component on a prototype branch.** Components live on component branches.

## When the component is done

1. Suggest a save (commit) checkpoint if there are unsaved changes.
2. Offer to publish (push) the branch.
3. If this component is going to feed a prototype, remind the designer:

   > Your component branch is ready. When you want to use this in a prototype, we'll start a separate `design/<your-id>/prototype/<slug>` branch and pull this component in from there.
