/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Bundled as a string: an opaque origin cannot start a worker from a URL the app serves.
// oxlint-disable-next-line import/default -- `?raw` makes webpack hand over the source as a string
import workerSource from "pdfjs-dist/build/pdf.worker.min.mjs?raw";

import { startPdfUsercontent } from "./pdfUsercontent";
import "./index.pcss";

startPdfUsercontent({ workerSource });
