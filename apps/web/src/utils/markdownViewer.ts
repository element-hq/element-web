/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

export const MARKDOWN_MIMETYPES = new Set(["text/markdown", "text/x-markdown"]);

/**
 * Mimetypes a browser or client hands out when it does not know what a file is. For these the file
 * name is a better guide than the mimetype.
 */
const GENERIC_MIMETYPES = new Set(["text/plain", "application/octet-stream"]);

const MARKDOWN_EXTENSIONS = [".md", ".markdown"];

/**
 * Whether a file with this mimetype and name is a Markdown file the viewer can open.
 *
 * A Markdown mimetype is enough on its own. Failing that, a `.md` or `.markdown` file name counts when
 * the mimetype is missing or generic, since many senders never label Markdown as such. Parameters after
 * the type itself (`text/markdown; charset=utf-8`) are ignored.
 */
export function isMarkdownFile(mimetype?: string, name?: string): boolean {
    const baseMimetype = mimetype?.split(";")[0].trim().toLowerCase();
    if (baseMimetype && MARKDOWN_MIMETYPES.has(baseMimetype)) return true;
    if (baseMimetype && !GENERIC_MIMETYPES.has(baseMimetype)) return false;

    const lowerName = (name ?? "").toLowerCase();
    return MARKDOWN_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}
