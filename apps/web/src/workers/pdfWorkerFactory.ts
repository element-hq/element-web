/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

export default function factory(options?: WorkerOptions): Worker {
    return new Worker(
        /* webpackChunkName: "pdf.worker" */ new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
        options,
    );
}
