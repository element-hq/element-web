/**
 * CLI wrapper for listing Figma file components.
 *
 * Usage:
 *   node scripts/design/figma-components.mjs <fileKey> [limit]
 *
 * Examples:
 *   node scripts/design/figma-components.mjs IjNuVxaLRhe2MotMWJ9EtG
 *   node scripts/design/figma-components.mjs IjNuVxaLRhe2MotMWJ9EtG 50
 */

import { getFigmaComponents } from "./figma-api.mjs";

const fileKey = process.argv[2];
const limit = process.argv[3] ? Number.parseInt(process.argv[3], 10) : undefined;

if (!fileKey) {
    console.error("Usage: figma-components <fileKey> [limit]");
    console.error("  fileKey — the alphanumeric file ID from a Figma URL");
    console.error("  limit   — max components to return (default: all)");
    process.exit(1);
}

try {
    const result = await getFigmaComponents(limit, fileKey);
    console.log(JSON.stringify(result, null, 2));
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
