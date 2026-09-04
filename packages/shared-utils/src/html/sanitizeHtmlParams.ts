/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type IOptions } from "sanitize-html";

import { isUrlPermitted, PERMITTED_URL_SCHEMES } from "./isUrlPermitted";
import type { HtmlSanitizeOptions } from "./sanitizeHtml";

const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/** Element Web formatting tags accepted by the shared sanitizer. */
export const MATRIX_FORMATTING_TAGS = [
    "font",
    "del",
    "s",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "p",
    "a",
    "ul",
    "ol",
    "sup",
    "sub",
    "nl",
    "li",
    "b",
    "i",
    "u",
    "strong",
    "em",
    "strike",
    "code",
    "hr",
    "br",
    "div",
    "table",
    "thead",
    "caption",
    "tbody",
    "tr",
    "th",
    "td",
    "pre",
    "span",
    "img",
    "details",
    "summary",
];

const MATRIX_ALLOWED_ATTRIBUTES: NonNullable<IOptions["allowedAttributes"]> = {
    font: ["color", "data-mx-bg-color", "data-mx-color", "style"],
    span: ["data-mx-maths", "data-mx-bg-color", "data-mx-color", "data-mx-spoiler", "style"],
    div: ["data-mx-maths"],
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "style"],
    ol: ["start"],
    code: ["class"],
};

const DANGEROUS_NON_TEXT_TAGS = [
    "script",
    "style",
    "template",
    "iframe",
    "object",
    "embed",
    "svg",
    "textarea",
    "option",
    "xmp",
];

type Attributes = Record<string, string>;
type Transform = (tagName: string, attribs: Attributes) => { tagName: string; attribs: Attributes; text?: string };
type AllowedAttribute = string | { name: string };

function attributeName(attribute: AllowedAttribute): string {
    return typeof attribute === "string" ? attribute : attribute.name;
}

function isTransform(value: string | Transform | undefined): value is Transform {
    return typeof value === "function";
}

function transformAnchor(tagName: string, attribs: Attributes, preserveTarget: boolean): ReturnType<Transform> {
    if (!attribs.href || !isUrlPermitted(attribs.href)) {
        delete attribs.href;
        delete attribs.target;
        delete attribs.rel;
        return { tagName, attribs };
    }

    if (!preserveTarget) attribs.target = "_blank";
    attribs.rel = "noreferrer noopener";
    return { tagName, attribs };
}

function transformImage(tagName: string, attribs: Attributes): ReturnType<Transform> {
    // Element Web transforms MXC media into bounded HTTP(S) thumbnails before
    // sanitization. The shared default must not permit arbitrary remote images.
    if (!attribs.src?.startsWith("mxc://")) return { tagName, attribs: {} };
    return { tagName, attribs };
}

function transformCode(tagName: string, attribs: Attributes): ReturnType<Transform> {
    if (typeof attribs.class !== "undefined") {
        attribs.class = attribs.class
            .split(/\s/)
            .filter((className) => className.startsWith("language-") && !className.startsWith("language-_"))
            .join(" ");
    }
    return { tagName, attribs };
}

function transformFormatting(tagName: string, attribs: Attributes): ReturnType<Transform> {
    // Match Element Web's policy: arbitrary inline CSS is removed, while the
    // two Matrix colour attributes are converted only when strictly valid.
    if (tagName !== "img") delete attribs.style;

    const colours: Record<string, string> = {
        "data-mx-color": "color",
        "data-mx-bg-color": "background-color",
    };
    let style = "";

    for (const [sourceAttribute, cssProperty] of Object.entries(colours)) {
        const value = attribs[sourceAttribute];
        if (value && COLOR_REGEX.test(value)) {
            style += `${cssProperty}:${value};`;
            delete attribs[sourceAttribute];
        }
    }

    if (style) attribs.style = style + (attribs.style || "");
    return { tagName, attribs };
}

function allowedTags(options: HtmlSanitizeOptions): string[] {
    if (!options.allowedTags) return [...MATRIX_FORMATTING_TAGS];
    return options.allowedTags.filter((tag) => MATRIX_FORMATTING_TAGS.includes(tag));
}

function allowedAttributes(options: HtmlSanitizeOptions): NonNullable<IOptions["allowedAttributes"]> {
    const result: NonNullable<IOptions["allowedAttributes"]> = {};

    for (const [tagName, attributes] of Object.entries(MATRIX_ALLOWED_ATTRIBUTES)) {
        if (!options.allowedAttributes) {
            result[tagName] = [...attributes];
        } else {
            const requested = options.allowedAttributes[tagName] ?? options.allowedAttributes["*"] ?? [];
            const requestedNames = requested.map(attributeName);
            result[tagName] = attributes.filter((attribute: AllowedAttribute) =>
                requestedNames.includes(attributeName(attribute)),
            );
        }
    }

    // Consumers may add harmless data attributes needed by their rendering
    // context, but may not expand the policy to arbitrary executable HTML
    // attributes.
    for (const [tagName, attributes] of Object.entries(options.additionalAllowedAttributes ?? {})) {
        if (!result[tagName]) continue;
        result[tagName] = [
            ...result[tagName],
            ...attributes.filter((attribute) => /^data-[a-z0-9_.:-]+$/i.test(attribute)),
        ].filter((attribute, index, all) => all.indexOf(attribute) === index);
    }
    return result;
}

function selfClosingTags(options: HtmlSanitizeOptions): string[] {
    const defaults = ["img", "br", "hr"];
    return options.selfClosing ? options.selfClosing.filter((tag) => defaults.includes(tag)) : defaults;
}

/** Builds sanitize-html parameters from the Element Web policy and context options. */
export function createSanitizeHtmlParams(options: HtmlSanitizeOptions = {}): IOptions {
    const customTransforms = options.transformTags ?? {};
    const customAnchorTransform = customTransforms.a;
    const customImageTransform = customTransforms.img;
    const customCodeTransform = customTransforms.code;
    const customAllTransform = customTransforms["*"];

    return {
        allowedTags: allowedTags(options),
        allowedAttributes: allowedAttributes(options),
        selfClosing: selfClosingTags(options),
        allowedSchemes: [...PERMITTED_URL_SCHEMES],
        allowProtocolRelative: false,
        disallowedTagsMode: "discard",
        nonTextTags: [...DANGEROUS_NON_TEXT_TAGS],
        nestingLimit: options.nestingLimit ?? 50,
        textFilter: options.textFilter,
        transformTags: {
            "a": (tagName, attribs) => {
                const transformed = isTransform(customAnchorTransform)
                    ? customAnchorTransform(tagName, attribs)
                    : { tagName, attribs };
                return transformAnchor(transformed.tagName, transformed.attribs, isTransform(customAnchorTransform));
            },
            "img": (tagName, attribs) =>
                isTransform(customImageTransform)
                    ? customImageTransform(tagName, attribs)
                    : transformImage(tagName, attribs),
            "code": (tagName, attribs) => {
                const transformed = isTransform(customCodeTransform)
                    ? customCodeTransform(tagName, attribs)
                    : { tagName, attribs };
                return transformCode(transformed.tagName, transformed.attribs);
            },
            "*": (tagName, attribs) => {
                const base = transformFormatting(tagName, attribs);
                return isTransform(customAllTransform) ? customAllTransform(base.tagName, base.attribs) : base;
            },
        },
    };
}
