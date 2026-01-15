# @element-hq/web-shared-components

Shared React components library for Element Web, Aurora, Element
modules... This package provides opinionated UI components built on top of the
[Compound Design System](https://compound.element.io) and [Compound
Web](https://github.com/element-hq/compound-web). This is not a design system
by itself, but rather a set of big chunks of components.

## Installation in a new project

When adding this library to a new project, as well as installing
`@element-hq/web-shared-components` as normal, you will also need to add
[compound-web](https://github.com/element-hq/compound-web) as a peer
dependency:

```bash
yarn add @element-hq/web-shared-components
yarn add @vector-im/compound-web
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

```jsx
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
- Yarn 1.22.22+

### Setup

```bash
# Install dependencies
yarn install

# Build the library
yarn prepare
```

### Running Storybook

```bash
yarn storybook
```

### Write components

Most components should be written as [MVVM pattern](../../docs/MVVM.md) view
components. See existing components for examples. The exceptions are low level
components that don't need a view model.

### Tests

Two types of tests are available: unit tests and visual regression tests.

### Unit Tests

These tests cover the logic of the components and utilities. Built with Jest
and React Testing Library.

```bash
yarn test
```

### Visual Regression Tests

These tests ensure the UI components render correctly. They need Storybook to
be running and they will run in docker using [Playwright](../../playwright.md).

First run storybook:

```bash
yarn storybook
```

Then, in another terminal, run:

```bash
yarn test:storybook:update
```

Each story will be rendered and a screenshot will be taken and compared to the
existing baseline. If there are visual changes or AXE violation, the test will
fail.

### Translations

First see our [translation guide](../../docs/translation.md) and [translation dev guide](../../docs/translation-dev.md).
To generate translation strings for this package, run:

```bash
yarn i18n
```
