/**
 * CLI wrapper for fetching a specific Figma node.
 *
 * Usage:
 *   node scripts/design/figma-node.mjs <fileKey> <nodeId> [depth]
 *
 * Examples:
 *   node scripts/design/figma-node.mjs IjNuVxaLRhe2MotMWJ9EtG 417:19911
 *   node scripts/design/figma-node.mjs IjNuVxaLRhe2MotMWJ9EtG 417:19911 6
 */

import { getFigmaNode } from "./figma-api.mjs";

const fileKey = process.argv[2];
const nodeId = process.argv[3];
const depth = Number.parseInt(process.argv[4] ?? "4", 10);

if (!fileKey || !nodeId) {
    console.error("Usage: figma-node <fileKey> <nodeId> [depth]");
    console.error("  fileKey — the alphanumeric file ID from a Figma URL");
    console.error("  nodeId  — the node ID, e.g. 417:19911");
    console.error("  depth   — child depth 1-6, default 4");
    process.exit(1);
}

try {
    const result = await getFigmaNode(nodeId, depth, fileKey);
    console.log(JSON.stringify(result, null, 2));
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
