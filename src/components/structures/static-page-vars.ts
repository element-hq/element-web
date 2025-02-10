/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// We're importing via require specifically so the svg becomes a URI rather than a DOM element.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const matrixSvg = require("../../../res/img/matrix.svg").default;

/**
 * Intended to replace $matrixLogo in the welcome page.
 */
export const MATRIX_LOGO_HTML = `<a href="https://matrix.org" target="_blank" rel="noreferrer noopener">
    <img width="79" height="34" alt="Matrix" style="padding-left: 1px;vertical-align: middle" src="${matrixSvg}"/>
</a>`;
