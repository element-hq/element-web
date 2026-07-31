/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import genWorkflowMermaid from "../../scripts/gen-workflow-mermaid";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
    async paths() {
        const root = join(__dirname, "..", "..");

        return [
            {
                params: { id: "automations" },
                content: await genWorkflowMermaid([root, join(root, "node_modules", "matrix-js-sdk")]),
            },
        ];
    },
};
