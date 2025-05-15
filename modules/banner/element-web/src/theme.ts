/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

const theme = {
    textColor: "var(--cpd-color-text-primary)",
    bannerBackgroundColor: "var(--cpd-color-bg-canvas-default)",
    bannerHeight: "60px",
    triggerWidth: "68px",
    triggerBackgroundColor: "var(--cpd-color-bg-subtle-primary)",
    // triggerBackgroundColorHover: "var(--cpd-color-bg-accent-hovered)",
    triggerBackgroundColorHover: "var(--cpd-color-text-action-accent)",
    triggerColor: "var(--cpd-color-text-primary)",
    triggerColorHover: "var(--cpd-color-bg-canvas-default)",
    menuWidth: "320px",
    menuBackgroundColor: "var(--cpd-color-bg-canvas-default)",
    menuButtonBackgroundColorHover: "var(--cpd-color-bg-subtle-primary)",
};

type Theme = typeof theme;

export { theme };

declare module "styled-components" {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    export interface DefaultTheme extends Theme {}
}
