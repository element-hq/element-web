/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import sanitizeHtmlLibrary, { type IOptions } from "sanitize-html";

import { createSanitizeHtmlParams } from "./sanitizeHtmlParams";

/** Attribute map passed to string-only sanitization transforms. */
export type HtmlSanitizeAttributes = Record<string, string>;

export interface HtmlSanitizeOptions {
    /** Restrict the Element Web tag policy further for a specific rendering context. */
    allowedTags?: string[];
    /** Restrict the Element Web attribute policy further for a specific rendering context. */
    allowedAttributes?: Exclude<IOptions["allowedAttributes"], false>;
    /** Add narrowly scoped, data-* attributes for an Element Web rendering context. */
    additionalAllowedAttributes?: Record<string, string[]>;
    /** Restrict the Element Web self-closing tag policy further for a specific rendering context. */
    selfClosing?: string[];
    /** Add rendering-context transforms; the shared Element Web transforms are always applied as well. */
    transformTags?: NonNullable<IOptions["transformTags"]>;
    /** Transform text nodes after the shared HTML policy has been applied. */
    textFilter?: IOptions["textFilter"];
    /** Maximum permitted HTML nesting depth; defaults to 50. */
    nestingLimit?: number;
}

/**
 * Sanitizes untrusted Matrix-compatible HTML and returns safe HTML text.
 *
 * This function is deliberately string-based: it has no React or browser DOM
 * dependency and can be used in build pipelines and server-side code.
 */
export function sanitizeHtml(html: string | null | undefined, options: HtmlSanitizeOptions = {}): string {
    if (typeof html !== "string" || html.length === 0) return "";

    try {
        return sanitizeHtmlLibrary(html, createSanitizeHtmlParams(options));
    } catch {
        return "";
    }
}

/** Returns sanitized text with all HTML tags removed. */
export function sanitizeHtmlText(html: string | null | undefined): string {
    if (typeof html !== "string" || html.length === 0) return "";

    try {
        return sanitizeHtmlLibrary(html, {
            ...createSanitizeHtmlParams({ allowedTags: [], allowedAttributes: {}, selfClosing: [] }),
            disallowedTagsMode: "discard",
        });
    } catch {
        return "";
    }
}
