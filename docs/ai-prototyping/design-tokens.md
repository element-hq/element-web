# Design tokens

The shared-components package is styled with Compound design tokens. Prototype stories should use those token variables instead of hard-coded colors, spacing, or typography.

## Spacing

- Use `var(--cpd-space-1x)` through `var(--cpd-space-8x)` for gaps, padding, and radii.
- Common patterns in this repository use `var(--cpd-space-2x)` to `var(--cpd-space-5x)`.

## Typography

- Use font shorthands such as `var(--cpd-font-body-md-regular)`, `var(--cpd-font-body-md-semibold)`, and `var(--cpd-font-heading-sm-semibold)`.
- Use text colors like `var(--cpd-color-text-primary)` and `var(--cpd-color-text-secondary)`.

## Surfaces and borders

- Default panel background: `var(--cpd-color-bg-canvas-default)`.
- Subtle surface background: `var(--cpd-color-bg-subtle-secondary)` or `var(--cpd-color-bg-subtle-primary)`.
- Borders: `var(--cpd-color-border-interactive-secondary)` for neutral framing.

## Actions and accents

- Accent backgrounds: `var(--cpd-color-bg-accent-rest)`.
- On-accent text: `var(--cpd-color-text-on-solid-primary)`.
- Links and emphasis should stay within the token palette rather than introducing custom brand colors.

## Guidance

- Prefer token-driven CSS modules or inline styles using `var(--cpd-...)`.
- Avoid raw hex values unless the underlying component API requires them.
- Match existing shared-components visuals before inventing new theme primitives in a prototype.