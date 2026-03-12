# @element-hq/web-shared-components

[Online storybook](https://shared-components-storybook.element.dev)

Shared React components library for Element Web, Aurora, Element
modules... This package provides opinionated UI components built on top of the
[Compound Design System](https://compound.element.io) and [Compound
Web](https://github.com/element-hq/compound-web). This is not a design system
by itself, but rather a set of larger components.

## Installation in a new project

When adding this library to a new project, as well as installing
`@element-hq/web-shared-components` as normal, you will also need to add
[compound-web](https://github.com/element-hq/compound-web) as a peer
dependency:

```bash
pnpm add @element-hq/web-shared-components
pnpm add @vector-im/compound-web
```

(This avoids problems where we end up with different versions of compound-web in the
top-level project and web-shared-components).

## Usage

### Basic Import

Both JavaScript and CSS can be imported as follows:

```javascript
import { RoomListHeaderView, useViewModel } from "@element-hq/web-shared-components";
import "@element-hq/web-shared-components/dist/element-web-shared-components.css";
```

or in CSS file:

```css
@import url("@element-hq/web-shared-components");
```

### Using Components

There are two kinds of components in this library:

- _regular_ react component which doesn't follow specific pattern.
- _view_ component(MVVM pattern).

> [!TIP]
> These components are available in the project storybook.

#### Regular Components

These components can be used directly by passing props. Example:

```tsx
import { Flex } from "@element-hq/web-shared-components";
function MyApp() {
    return <Flex align="center" />;
}
```

#### View (MVVM) Components

These components follow the [MVVM pattern](../../docs/MVVM.md). A ViewModel
instance should be provided as a prop.

Here's a basic example:

```tsx
import { ViewExample } from "@element-hq/web-shared-components";

function MyApp() {
    const viewModel = new ViewModelExample();
    return <ViewExample vm={viewModel} />;
}
```

### Utilities

#### Internationalization

- `useI18n()` - Hook for translations
- `I18nApi` - Internationalization API utilities

#### Date & Time

- `DateUtils` - Date formatting and manipulation
- `humanize` - Human-readable time formatting

#### Formatting

- `FormattingUtils` - Text and data formatting utilities
- `numbers` - Number formatting utilities

## Development

### Prerequisites

- Node.js >= 20.0.0
- pnpm => 10

### Setup

```bash
# Install dependencies
pnpm install

# Build the library
pnpm prepack
```

### Running Storybook

```bash
pnpm storybook
```

### Write components

Most components should be written as [MVVM pattern](../../docs/MVVM.md) view
components. See existing components for examples. The exceptions are low level
components that don't need a view model.

### Write Storybook Stories

All components should have accompanying Storybook stories for documentation and visual testing. Stories are written in TypeScript using the [Component Story Format (CSF)](https://storybook.js.org/docs/api/csf).

#### Story File Structure

Place the story file next to the component with the `.stories.tsx` extension:

```
MyComponent/
├── MyComponent.tsx
├── MyComponent.module.css
└── MyComponent.stories.tsx
```

#### Regular Component Stories

For regular React components (non-MVVM), create stories by defining a meta object and story variations:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { MyComponent } from "./MyComponent";

const meta = {
    title: "Category/MyComponent",
    component: MyComponent,
    tags: ["autodocs"],
    args: {
        // Default args for all stories
        label: "Default Label",
        onClick: fn(), // Mock function for tracking interactions
    },
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story uses the default args
export const Default: Story = {};

// Override specific args for variations
export const WithCustomLabel: Story = {
    args: {
        label: "Custom Label",
    },
};

export const Disabled: Story = {
    args: {
        disabled: true,
    },
};
```

#### MVVM Component Stories

For MVVM components, create a wrapper component that uses `useMockedViewModel` and `withViewDocs`:

```tsx
import React, { type JSX } from "react";
import { fn } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MyComponentView, type MyComponentViewSnapshot, type MyComponentViewActions } from "./MyComponentView";
import { useMockedViewModel } from "../../viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";

// Combine snapshot and actions for easier typing
type MyComponentProps = MyComponentViewSnapshot & MyComponentViewActions;

// Wrapper component that creates a mocked ViewModel.
// Must be a named variable (not inline) for docgen to extract its props.
const MyComponentViewWrapperImpl = ({ onAction, ...rest }: MyComponentProps): JSX.Element => {
    const vm = useMockedViewModel(rest, {
        onAction,
    });
    return <MyComponentView vm={vm} />;
};
// withViewDocs copies the View's JSDoc description onto the wrapper for Storybook autodocs
const MyComponentViewWrapper = withViewDocs(MyComponentViewWrapperImpl, MyComponentView);

// Must use `satisfies` (not `as` or `: Meta`) to preserve type info for docgen
const meta = {
    title: "Category/MyComponentView",
    component: MyComponentViewWrapper,
    tags: ["autodocs"],
    args: {
        // Snapshot properties (state)
        title: "Default Title",
        isLoading: false,
        // Action properties (callbacks)
        onAction: fn(),
    },
} satisfies Meta<typeof MyComponentViewWrapper>;

export default meta;
type Story = StoryObj<typeof MyComponentViewWrapper>;

export const Default: Story = {};

export const Loading: Story = {
    args: {
        isLoading: true,
    },
};
```

Thanks to this approach, we can directly use primitives in the story arguments instead of a view model object.

> [!IMPORTANT]
> Three requirements must be met for snapshot field documentation to appear in Storybook's ArgTypes table:
>
> 1. **Named wrapper variable** — the wrapper must be assigned to a named `const` (e.g. `MyComponentViewWrapperImpl`) before being passed to `withViewDocs`, so that `react-docgen-typescript` can extract its props.
> 2. **`withViewDocs` call** — wraps the wrapper component with the original View to copy the View's JSDoc description.
> 3. **`satisfies Meta`** — the meta object must use `satisfies Meta<...>` (not `as Meta<...>` or `: Meta<...> =`). Type assertions and annotations erase the inferred component type that docgen relies on.

#### Linking Figma Designs

This package uses [@storybook/addon-designs](https://github.com/storybookjs/addon-designs) to embed Figma designs directly in Storybook. This helps developers compare their implementation with the design specs.

1. **Get the Figma URL**: Open your design in Figma, click "Share" → "Copy link"
2. **Add to story parameters**: Include the `design` object in the meta's `parameters`
3. **Supported URL formats**:
    - File links: `https://www.figma.com/file/...`
    - Design links: `https://www.figma.com/design/...`
    - Specific node: `https://www.figma.com/design/...?node-id=123-456`

Example with Figma integration:

```tsx
const meta = {
    title: "Room List/RoomListSearchView",
    component: RoomListSearchViewWrapper,
    tags: ["autodocs"],
    args: {
        // ... your args
    },
    parameters: {
        design: {
            type: "figma",
            url: "https://www.figma.com/design/vlmt46QDdE4dgXDiyBJXqp/ER-33-Left-Panel?node-id=98-1979",
        },
    },
} satisfies Meta<typeof RoomListSearchViewWrapper>;

export default meta;
```

The Figma design will appear in the "Design" tab in Storybook.

#### Non-UI Utility Stories

For utility functions, helpers, and other non-UI exports, create documentation stories using TSX format with TypeDoc-generated markdown.

`src/utils/humanize.stories.tsx`

```tsx
import React from "react";
import { Markdown } from "@storybook/addon-docs/blocks";

import type { Meta } from "@storybook/react-vite";
import humanizeTimeDoc from "../../typedoc/functions/humanizeTime.md?raw";

const meta = {
    title: "utils/humanize",
    parameters: {
        docs: {
            page: () => (
                <>
                    <h1>humanize</h1>
                    <Markdown>{humanizeTimeDoc}</Markdown>
                </>
            ),
        },
    },
    tags: ["autodocs", "skip-test"],
} satisfies Meta;

export default meta;

// Docs-only story - renders nothing but triggers autodocs
export const Docs = {
    render: () => null,
};
```

> [!NOTE]
> Be sure to include the `skip-test` tag in your utility stories to prevent them from running as visual tests.

**Workflow:**

1. Write TsDoc in your utility function
2. Export the function from `src/index.ts`
3. Run `pnpm build:doc` to generate TypeDoc markdown
4. Create a `.stories.tsx` file importing the generated markdown
5. The documentation appears automatically in Storybook

### Tests

Two types of tests are available: unit tests and visual regression tests.

### Unit Tests

These tests cover the logic of the components and utilities. Built with Vitest
and React Testing Library.

```bash
pnpm test:unit
```

### Visual Regression Tests

These tests ensure the UI components render correctly.
Built with Storybook and run under vitest using playwright.

```bash
pnpm test:storybook:update
```

Each story will be rendered and a screenshot will be taken and compared to the
existing baseline. If there are visual changes or AXE violation, the test will
fail.

Screenshots are located in `packages/shared-components/__vis__/`.

> [!IMPORTANT]
> In case of docker issues with Playwright, see [playwright EW documentation](https://github.com/element-hq/element-web/blob/develop/docs/playwright.md#supported-container-runtimes).

### Translations

First see our [translation guide](../../docs/translating.md) and [translation dev guide](../../docs/translating-dev.md).
To generate translation strings for this package, run:

```bash
pnpm i18n
```

## Publish a new version

Two steps are required to publish a new version of this package:

1. Bump the version in `package.json` following semver rules and open a PR.
2. Once merged run the [github workflow](https://github.com/element-hq/element-web/actions/workflows/shared-component-publish.yaml)
