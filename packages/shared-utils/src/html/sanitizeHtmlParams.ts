/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { isUrlPermitted, PERMITTED_URL_SCHEMES } from "./isUrlPermitted";
import type {
    HtmlSanitizeAllowedAttributes,
    HtmlSanitizeAttributes,
    HtmlSanitizeOptions,
    HtmlSanitizeTextFilter,
    HtmlSanitizeTransform,
    HtmlSanitizeTransformTags,
} from "./sanitizeHtml";

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

const MATRIX_ALLOWED_ATTRIBUTES: HtmlSanitizeAllowedAttributes = {
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

function isTransform(value: HtmlSanitizeTransform | undefined): value is HtmlSanitizeTransform {
    return typeof value === "function";
}

/**
 * Detect whitespace and ASCII control characters which can alter how a URL is
 * parsed or normalised by the browser.
 */
function hasUnsafeControlCharacter(input: string): boolean {
    return [...input].some((character) => {
        const code = character.codePointAt(0);
        return code !== undefined && (code <= 0x20 || (code >= 0x7f && code <= 0x9f));
    });
}

/**
 * Check whether a URL is relative to the current document rather than pointing
 * at another origin. Scheme-like and protocol-relative values are rejected
 * explicitly, then URL parsing against a non-real origin handles malformed
 * values and confirms the result stays on that origin.
 */
function isRelativeUrl(inputUrl: string): boolean {
    if (
        !inputUrl ||
        inputUrl.startsWith("//") ||
        /^[a-z][a-z\d+.-]*:/i.test(inputUrl) ||
        hasUnsafeControlCharacter(inputUrl)
    ) {
        return false;
    }

    try {
        return new URL(inputUrl, "https://element.invalid").origin === "https://element.invalid";
    } catch {
        return false;
    }
}

function isHrefPermitted(inputUrl: string): boolean {
    return isUrlPermitted(inputUrl) || isRelativeUrl(inputUrl);
}

function transformAnchor(
    tagName: string,
    attribs: HtmlSanitizeAttributes,
    preserveTarget: boolean,
): ReturnType<HtmlSanitizeTransform> {
    if (!attribs.href) {
        delete attribs.href;
        // A consumer transform may intentionally retain attributes on an
        // href-less anchor. Preserve those when the consumer owns rendering.
        if (!preserveTarget) {
            delete attribs.target;
            delete attribs.rel;
        }
        return { tagName, attribs };
    }

    if (!isHrefPermitted(attribs.href)) {
        delete attribs.href;
        delete attribs.target;
        delete attribs.rel;
        return { tagName, attribs };
    }

    if (!preserveTarget) {
        attribs.target = "_blank";
        attribs.rel = "noreferrer noopener";
    } else if (attribs.target === "_blank") {
        attribs.rel = "noreferrer noopener";
    }
    return { tagName, attribs };
}

function transformImage(tagName: string, attribs: HtmlSanitizeAttributes): ReturnType<HtmlSanitizeTransform> {
    // Element Web transforms MXC media into bounded HTTP(S) thumbnails before
    // sanitization. The shared default must not permit arbitrary remote images.
    if (!attribs.src?.startsWith("mxc://")) return { tagName, attribs: {} };
    return { tagName, attribs };
}

function transformCode(tagName: string, attribs: HtmlSanitizeAttributes): ReturnType<HtmlSanitizeTransform> {
    if (typeof attribs.class !== "undefined") {
        attribs.class = attribs.class
            .split(/\s/)
            .filter((className) => className.startsWith("language-") && !className.startsWith("language-_"))
            .join(" ");
    }
    return { tagName, attribs };
}

function transformFormatting(tagName: string, attribs: HtmlSanitizeAttributes): ReturnType<HtmlSanitizeTransform> {
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

function allowedAttributes(options: HtmlSanitizeOptions): HtmlSanitizeAllowedAttributes {
    const result: HtmlSanitizeAllowedAttributes = {};

    for (const [tagName, attributes] of Object.entries(MATRIX_ALLOWED_ATTRIBUTES)) {
        if (!options.allowedAttributes) {
            result[tagName] = [...attributes];
        } else {
            const requested = options.allowedAttributes[tagName] ?? options.allowedAttributes["*"] ?? [];
            result[tagName] = attributes.filter((attribute) => requested.includes(attribute));
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

type SanitizerOptions = {
    allowedTags: string[];
    allowedAttributes: HtmlSanitizeAllowedAttributes;
    selfClosing: string[];
    allowedSchemes: string[];
    allowProtocolRelative: boolean;
    disallowedTagsMode: "discard";
    nonTextTags: string[];
    nestingLimit: number;
    textFilter?: HtmlSanitizeTextFilter;
    transformTags: HtmlSanitizeTransformTags;
};

/** Builds sanitize-html parameters from the Element Web policy and context options. */
export function createSanitizeHtmlParams(options: HtmlSanitizeOptions = {}): SanitizerOptions {
    const customTransforms = options.transformTags ?? {};
    const customAnchorTransform = customTransforms.a;
    const customImageTransform = customTransforms.img;
    const customCodeTransform = customTransforms.code;
    const customAllTransform = customTransforms["*"];

    const transformTags: HtmlSanitizeTransformTags = {
        // The app owns link presentation, but shared URL validation is always
        // applied to the result of that transform.
        "a": (tagName, attribs) => {
            const transformed = isTransform(customAnchorTransform)
                ? customAnchorTransform(tagName, attribs)
                : { tagName, attribs };
            return transformAnchor(transformed.tagName, transformed.attribs, isTransform(customAnchorTransform));
        },
        // A custom image transform is an explicit, trusted replacement for
        // the default MXC-only image policy.
        "img": isTransform(customImageTransform) ? customImageTransform : transformImage,
        "code": (tagName, attribs) => {
            if (isTransform(customCodeTransform)) return customCodeTransform(tagName, attribs);
            return transformCode(tagName, attribs);
        },
        // A custom all-tags transform replaces the shared formatting policy so
        // consumers can explicitly opt into their own style handling.
        "*": isTransform(customAllTransform) ? customAllTransform : transformFormatting,
    };

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
        transformTags,
    };
}
