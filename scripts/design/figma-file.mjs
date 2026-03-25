/**
 * CLI wrapper for fetching a Figma file overview.
 *
 * Usage:
 *   node scripts/design/figma-file.mjs <fileKey>
 *
 * Example:
 *   node scripts/design/figma-file.mjs IjNuVxaLRhe2MotMWJ9EtG
 */

import { getFigmaFile } from "./figma-api.mjs";

const fileKey = process.argv[2];

if (!fileKey) {
    console.error("Usage: figma-file <fileKey>");
    console.error("  fileKey — the alphanumeric file ID from a Figma URL");
    process.exit(1);
}

try {
    const result = await getFigmaFile(fileKey);
    console.log(JSON.stringify(result, null, 2));
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
