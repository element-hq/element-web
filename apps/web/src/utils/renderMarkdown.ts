/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { Marked } from "marked";
import { sanitizeHtml } from "@element-hq/element-web-shared-utils";

import { sanitizeHtmlParams } from "../Linkify";

// One parser, configured once. GitHub-flavoured Markdown is what most .md files are written in.
const marked = new Marked({ gfm: true });

/**
 * Render a Markdown document to HTML that is safe to put in the DOM.
 *
 * marked passes raw HTML in the source straight through, so its output goes through the same sanitizer
 * as message bodies: scripts, event handlers and unknown tags are dropped, links open in a new tab, and
 * images are limited to the homeserver's media so a document cannot phone home.
 */
export function renderMarkdown(source: string): string {
    return sanitizeHtml(marked.parse(source, { async: false }), sanitizeHtmlParams);
}
