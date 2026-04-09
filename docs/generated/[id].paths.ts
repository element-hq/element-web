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
