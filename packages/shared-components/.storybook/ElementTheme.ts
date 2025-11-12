/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { create } from "storybook/theming";

export default create({
    base: "light",

    // Colors
    textColor: "#1b1d22",
    colorSecondary: "#111111",

    // UI
    appBg: "#ffffff",
    appContentBg: "#ffffff",

    // Toolbar
    barBg: "#ffffff",

    brandTitle: "Element Web",
    brandUrl: "https://github.com/element-hq/element-web",
    brandImage: "https://element.io/images/logo-ele-secondary.svg",
    brandTarget: "_self",
});
