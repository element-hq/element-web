/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import sanitizeHtmlLibrary from "sanitize-html";

import { createSanitizeHtmlParams } from "./sanitizeHtmlParams";

/** Attribute map passed to string-only sanitization transforms. */
export type HtmlSanitizeAttributes = Record<string, string>;

/** Attribute names allowed for each HTML tag. */
export type HtmlSanitizeAllowedAttributes = Record<string, string[]>;

/** Result returned by a trusted HTML tag transform. */
export interface HtmlSanitizeTransformResult {
    tagName: string;
    attribs: HtmlSanitizeAttributes;
    text?: string;
}

/** Trusted transform applied to an HTML tag before the shared policy is applied. */
export type HtmlSanitizeTransform = (tagName: string, attribs: HtmlSanitizeAttributes) => HtmlSanitizeTransformResult;

/** Rendering transforms keyed by HTML tag name. */
export type HtmlSanitizeTransformTags = Record<string, HtmlSanitizeTransform>;

/** Callback used to transform sanitized text nodes. */
export type HtmlSanitizeTextFilter = (text: string, tagName: string) => string;

/** Options for restricting or extending the shared Matrix-compatible HTML policy. */
export interface HtmlSanitizeOptions {
    /** Restrict the Element Web tag policy further for a specific rendering context. */
    allowedTags?: string[];
    /** Restrict the Element Web attribute policy further for a specific rendering context. */
    allowedAttributes?: HtmlSanitizeAllowedAttributes;
    /** Add narrowly scoped, data-* attributes for an Element Web rendering context. */
    additionalAllowedAttributes?: Record<string, string[]>;
    /** Restrict the Element Web self-closing tag policy further for a specific rendering context. */
    selfClosing?: string[];
    /**
     * Add trusted rendering-context transforms. A supplied transform replaces
     * the corresponding shared rendering transform; anchor URL validation is
     * always retained.
     */
    transformTags?: HtmlSanitizeTransformTags;
    /** Transform text nodes after the shared HTML policy has been applied. */
    textFilter?: HtmlSanitizeTextFilter;
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
