/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

const theme = {
    textColor: "var(--cpd-color-text-primary)",
    subheadingColor: "var(--cpd-color-text-secondary)", // TODO
    bannerBackgroundColor: "var(--cpd-color-bg-canvas-default)",
    bannerHeight: "60px",
    triggerWidth: "68px",
    triggerBackgroundColor: "var(--cpd-color-bg-subtle-secondary)",
    triggerBackgroundColorHover: "var(--cpd-color-bg-accent-hovered)",
    triggerBackgroundColorPressed: "var(--cpd-color-bg-accent-pressed)",
    triggerColor: "var(--cpd-color-icon-primary)",
    triggerColorContrast: "var(--cpd-color-icon-on-solid-primary)",
    menuWidth: "320px",
    menuBackgroundColor: "var(--cpd-color-bg-canvas-default)",
    menuButtonBackgroundColorHover: "var(--cpd-color-bg-action-secondary-hovered)",
    menuButtonBackgroundColorPressed: "var(--cpd-color-bg-action-secondary-pressed)",
};

type Theme = typeof theme;

export { theme };

declare module "styled-components" {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    export interface DefaultTheme extends Theme {}
}
