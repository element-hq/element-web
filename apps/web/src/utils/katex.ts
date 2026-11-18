/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import type katexModule from "katex";

// KaTeX is only needed to render LaTeX maths, which is behind a labs flag, so it is loaded on first use rather than
// with the rest of the app.

type Katex = typeof katexModule;

let katex: Katex | undefined;
let katexPromise: Promise<Katex> | undefined;

/**
 * Get KaTeX, if it has finished loading.
 * @returns KaTeX, or undefined if {@link loadKatex} has not yet completed.
 */
export function getKatex(): Katex | undefined {
    return katex;
}

/**
 * Load KaTeX, if it is not loaded already.
 * @returns a promise which resolves with KaTeX once it is available from {@link getKatex}.
 */
export function loadKatex(): Promise<Katex> {
    katexPromise ??= import("katex").then(
        ({ default: loaded }) => (katex = loaded),
        (e) => {
            // Allow a later call to try again
            katexPromise = undefined;
            throw e;
        },
    );
    return katexPromise;
}
