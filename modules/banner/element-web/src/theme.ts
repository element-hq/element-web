/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { z } from "zod";

export const Theme = z.object({
    textColor: z.string().default("var(--cpd-color-text-primary)"),
    subheadingColor: z.string().default("var(--cpd-color-text-secondary)"),
    bannerBackgroundColor: z.string().default("var(--cpd-color-bg-canvas-default)"),
    bannerHeight: z.string().default("60px"),
    triggerWidth: z.string().default("68px"),
    triggerBackgroundColor: z.string().default("var(--cpd-color-bg-subtle-secondary)"),
    triggerBackgroundColorHover: z.string().default("var(--cpd-color-bg-accent-hovered)"),
    triggerBackgroundColorPressed: z.string().default("var(--cpd-color-bg-accent-pressed)"),
    triggerColor: z.string().default("var(--cpd-color-icon-primary)"),
    triggerColorContrast: z.string().default("var(--cpd-color-icon-on-solid-primary)"),
    menuWidth: z.string().default("320px"),
    menuBackgroundColor: z.string().default("var(--cpd-color-bg-canvas-default)"),
    menuButtonBackgroundColorHover: z.string().default("var(--cpd-color-bg-action-secondary-hovered)"),
    menuButtonBackgroundColorPressed: z.string().default("var(--cpd-color-bg-action-secondary-pressed)"),
});

export type Theme = z.infer<typeof Theme>;

declare module "styled-components" {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    export interface DefaultTheme extends Theme {}
}
