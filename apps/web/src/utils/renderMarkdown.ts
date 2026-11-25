/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { sanitizeHtml } from "@element-hq/element-web-shared-utils";

import Markdown from "../Markdown";
import { sanitizeHtmlParams } from "../Linkify";

/**
 * Render a Markdown document to HTML that is safe to put in the DOM.
 *
 * This is the parser messages are composed with, so a document renders the way the same text would
 * in a message: raw HTML in the source is escaped rather than passed through, and links open in a
 * new tab. Soft breaks are kept, since documents are often wrapped at a fixed column. The result then
 * goes through the same sanitizer as message bodies, which limits images to the homeserver's media
 * so a document cannot phone home.
 */
export function renderMarkdown(source: string): string {
    const html = new Markdown(source).toHTML({ externalLinks: true, hardSoftBreaks: false });

    return sanitizeHtml(html, sanitizeHtmlParams);
}
