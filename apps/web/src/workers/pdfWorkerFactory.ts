/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * pdf.js ships its own pre-built worker rather than us authoring one, but we still bundle it
 * ourselves so it is served same-origin and satisfies our `worker-src 'self'` CSP.
 */
export default function factory(options?: WorkerOptions): Worker {
    return new Worker(
        /* webpackChunkName: "pdf.worker" */ new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
        { type: "module", ...options },
    );
}
