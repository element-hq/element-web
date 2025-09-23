/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { z } from "zod/mini";

export const Theme = z.object({
    textColor: z.prefault(z.string(), "var(--cpd-color-text-primary)"),
    subheadingColor: z.prefault(z.string(), "var(--cpd-color-text-secondary)"),
    bannerBackgroundColor: z.prefault(z.string(), "var(--cpd-color-bg-canvas-default)"),
    bannerHeight: z.prefault(z.string(), "60px"),
    triggerWidth: z.prefault(z.string(), "68px"),
    triggerBackgroundColor: z.prefault(z.string(), "var(--cpd-color-bg-subtle-secondary)"),
    triggerBackgroundColorHover: z.prefault(z.string(), "var(--cpd-color-bg-accent-hovered)"),
    triggerBackgroundColorPressed: z.prefault(z.string(), "var(--cpd-color-bg-accent-pressed)"),
    triggerColor: z.prefault(z.string(), "var(--cpd-color-icon-primary)"),
    triggerColorContrast: z.prefault(z.string(), "var(--cpd-color-icon-on-solid-primary)"),
    menuWidth: z.prefault(z.string(), "320px"),
    menuBackgroundColor: z.prefault(z.string(), "var(--cpd-color-bg-canvas-default)"),
    menuButtonBackgroundColorHover: z.prefault(z.string(), "var(--cpd-color-bg-action-secondary-hovered)"),
    menuButtonBackgroundColorPressed: z.prefault(z.string(), "var(--cpd-color-bg-action-secondary-pressed)"),
});

export type Theme = z.infer<typeof Theme>;

declare module "styled-components" {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    export interface DefaultTheme extends Theme {}
}
