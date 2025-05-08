/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { DefaultTheme } from "styled-components";

const bgCanvasDefault = "var(--cpd-color-bg-canvas-default)";
const textActionAccent = "var(--cpd-color-text-action-accent)";
const textPrimary = "var(--cpd-color-text-primary)";
const iconOnSolidPrimary = "var(--cpd-color-icon-on-solid-primary)";

const bodyMdSemibold = "var(--cpd-font-body-md-semibold)";

export const theme: DefaultTheme = {
    compound: {
        color: {
            bgCanvasDefault,
            textActionAccent,
            textPrimary,
            iconOnSolidPrimary,
        },
        font: {
            bodyMdSemibold,
        },
    },
    color: {
        accent: "#571EFA", // primary/700 TODO
    },
    navbar: {
        border: "1px solid #D3D7DE", // TODO
        boxShadow: "4px 4px 12px 0 rgba(118, 131, 156, 0.6)",
        height: "60px",
        triggerWidth: "68px",
        logoHeight: "34px",
    },
    menu: {
        // TODO
        width: "235px",
    },
};
