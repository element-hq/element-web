/*
Copyright 2024 New Vector Ltd.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2017, 2018 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type LegacyRef, type ReactNode } from "react";
import sanitizeHtml, { type IOptions } from "sanitize-html";
import classNames from "classnames";
import katex from "katex";
import { decode } from "html-entities";
import { type IContent } from "matrix-js-sdk/src/matrix";
import { type Optional } from "matrix-events-sdk";
import escapeHtml from "escape-html";
import { getEmojiFromUnicode } from "@matrix-org/emojibase-bindings";

import SettingsStore from "./settings/SettingsStore";
import { stripHTMLReply, stripPlainReply } from "./utils/Reply";
import { PERMITTED_URL_SCHEMES } from "./utils/UrlUtils";
import { sanitizeHtmlParams, transformTags } from "./Linkify";
import { graphemeSegmenter } from "./utils/strings";

export { Linkify, linkifyElement, linkifyAndSanitizeHtml } from "./Linkify";

// Anything outside the basic multilingual plane will be a surrogate pair
const SURROGATE_PAIR_PATTERN = /([\ud800-\udbff])([\udc00-\udfff])/;
// And there a bunch more symbol characters that emojibase has within the
// BMP, so this includes the ranges from 'letterlike symbols' to
// 'miscellaneous symbols and arrows' which should catch all of them
// (with plenty of false positives, but that's OK)
const SYMBOL_PATTERN = /([\u2100-\u2bff])/;

// Regex pattern for non-emoji characters that can appear in an "all-emoji" message
// (Zero-Width Space, other whitespace)
const EMOJI_SEPARATOR_REGEX = /[\u200B\s]/g;

// Regex for emoji. This includes any RGI_Emoji sequence followed by an optional
// emoji presentation VS (U+FE0F), but not those sequences that are followed by
// a text presentation VS (U+FE0E). We also count lone regional indicators
// (U+1F1E6-U+1F1FF). Technically this regex produces false negatives for emoji
// followed by U+FE0E when the emoji doesn't have a text variant, but in
// practice this doesn't matter.
export const EMOJI_REGEX = (() => {
    try {
        // Per our support policy, v mode is available to us, but we still don't
        // want the app to completely crash on older platforms. We use the
        // constructor here to avoid a syntax error on such platforms.
        return new RegExp("\\p{RGI_Emoji}(?!\\uFE0E)(?:(?<!\\uFE0F)\\uFE0F)?|[\\u{1f1e6}-\\u{1f1ff}]", "v");
    } catch {
        // v mode not supported; fall back to matching nothing
        return /(?!)/;
    }
})();

const BIGEMOJI_REGEX = (() => {
    try {
        return new RegExp(`^(${EMOJI_REGEX.source})+$`, "iv");
    } catch {
        // Fall back, just like for EMOJI_REGEX
        return /(?!)/;
    }
})();

/*
 * Return true if the given string contains emoji
 * Uses a much, much simpler regex than emojibase's so will give false
 * positives, but useful for fast-path testing strings to see if they
 * need emojification.
 */
function mightContainEmoji(str?: string): boolean {
    return !!str && (SURROGATE_PAIR_PATTERN.test(str) || SYMBOL_PATTERN.test(str));
}

/**
 * Returns the shortcode for an emoji character.
 *
 * @param {String} char The emoji character
 * @return {String} The shortcode (such as :thumbup:)
 */
export function unicodeToShortcode(char: string): string {
    const shortcodes = getEmojiFromUnicode(char)?.shortcodes;
    return shortcodes?.length ? `:${shortcodes[0]}:` : "";
}

/*
 * Given an untrusted HTML string, return a React node with an sanitized version
 * of that HTML.
 */
export function sanitizedHtmlNode(insaneHtml: string): ReactNode {
    const saneHtml = sanitizeHtml(insaneHtml, sanitizeHtmlParams);

    return <div dangerouslySetInnerHTML={{ __html: saneHtml }} dir="auto" />;
}

export function getHtmlText(insaneHtml: string): string {
    return sanitizeHtml(insaneHtml, {
        allowedTags: [],
        allowedAttributes: {},
        selfClosing: [],
        allowedSchemes: [],
        disallowedTagsMode: "discard",
    });
}

/**
 * Tests if a URL from an untrusted source may be safely put into the DOM
 * The biggest threat here is javascript: URIs.
 * Note that the HTML sanitiser library has its own internal logic for
 * doing this, to which we pass the same list of schemes. This is used in
 * other places we need to sanitise URLs.
 * @return true if permitted, otherwise false
 */
export function isUrlPermitted(inputUrl: string): boolean {
    try {
        // URL parser protocol includes the trailing colon
        return PERMITTED_URL_SCHEMES.includes(new URL(inputUrl).protocol.slice(0, -1));
    } catch {
        return false;
    }
}

// this is the same as the above except with less rewriting
const composerSanitizeHtmlParams: IOptions = {
    ...sanitizeHtmlParams,
    transformTags: {
        "code": transformTags["code"],
        "*": transformTags["*"],
    },
};

// reduced set of allowed tags to avoid turning topics into Myspace
const topicSanitizeHtmlParams: IOptions = {
    ...sanitizeHtmlParams,
    allowedTags: [
        "font", // custom to matrix for IRC-style font coloring
        "del", // for markdown
        "s",
        "a",
        "sup",
        "sub",
        "b",
        "i",
        "u",
        "strong",
        "em",
        "strike",
        "br",
        "div",
        "span",
    ],
};

abstract class BaseHighlighter<T extends React.ReactNode> {
    public constructor(
        public highlightClass: string,
        public highlightLink?: string,
    ) {}

    /**
     * Apply the highlights to a section of text
     *
     * @param {string} safeSnippet The snippet of text to apply the highlights
     *     to. This input must be sanitised as it will be treated as HTML.
     * @param {string[]} safeHighlights A list of substrings to highlight,
     *     sorted by descending length.
     *
     * returns a list of results (strings for HtmlHighligher, react nodes for
     * TextHighlighter).
     */
    public applyHighlights(safeSnippet: string, safeHighlights: string[]): T[] {
        let lastOffset = 0;
        let offset: number;
        let nodes: T[] = [];

        const safeHighlight = safeHighlights[0];
        while ((offset = safeSnippet.toLowerCase().indexOf(safeHighlight.toLowerCase(), lastOffset)) >= 0) {
            // handle preamble
            if (offset > lastOffset) {
                const subSnippet = safeSnippet.substring(lastOffset, offset);
                nodes = nodes.concat(this.applySubHighlights(subSnippet, safeHighlights));
            }

            // do highlight. use the original string rather than safeHighlight
            // to preserve the original casing.
            const endOffset = offset + safeHighlight.length;
            nodes.push(this.processSnippet(safeSnippet.substring(offset, endOffset), true));

            lastOffset = endOffset;
        }

        // handle postamble
        if (lastOffset !== safeSnippet.length) {
            const subSnippet = safeSnippet.substring(lastOffset, undefined);
            nodes = nodes.concat(this.applySubHighlights(subSnippet, safeHighlights));
        }
        return nodes;
    }

    private applySubHighlights(safeSnippet: string, safeHighlights: string[]): T[] {
        if (safeHighlights[1]) {
            // recurse into this range to check for the next set of highlight matches
            return this.applyHighlights(safeSnippet, safeHighlights.slice(1));
        } else {
            // no more highlights to be found, just return the unhighlighted string
            return [this.processSnippet(safeSnippet, false)];
        }
    }

    protected abstract processSnippet(snippet: string, highlight: boolean): T;
}

class HtmlHighlighter extends BaseHighlighter<string> {
    /* highlight the given snippet if required
     *
     * snippet: content of the span; must have been sanitised
     * highlight: true to highlight as a search match
     *
     * returns an HTML string
     */
    protected processSnippet(snippet: string, highlight: boolean): string {
        if (!highlight) {
            // nothing required here
            return snippet;
        }

        let span = `<span class="${this.highlightClass}">${snippet}</span>`;

        if (this.highlightLink) {
            span = `<a href="${encodeURI(this.highlightLink)}">${span}</a>`;
        }
        return span;
    }
}

const emojiToHtmlSpan = (emoji: string): string =>
    `<span class='mx_Emoji' title='${unicodeToShortcode(emoji)}'>${emoji}</span>`;
const emojiToJsxSpan = (emoji: string, key: number): JSX.Element => (
    <span key={key} className="mx_Emoji" title={unicodeToShortcode(emoji)}>
        {emoji}
    </span>
);

/**
 * Wraps emojis in <span> to style them separately from the rest of message. Consecutive emojis (and modifiers) are wrapped
 * in the same <span>.
 * @param {string} message the text to format
 * @param {boolean} isHtmlMessage whether the message contains HTML
 * @returns if isHtmlMessage is true, returns an array of strings, otherwise return an array of React Elements for emojis
 * and plain text for everything else
 */
export function formatEmojis(message: string | undefined, isHtmlMessage?: false): JSX.Element[];
export function formatEmojis(message: string | undefined, isHtmlMessage: true): string[];
export function formatEmojis(message: string | undefined, isHtmlMessage?: boolean): (JSX.Element | string)[] {
    const emojiToSpan = isHtmlMessage ? emojiToHtmlSpan : emojiToJsxSpan;
    const result: (JSX.Element | string)[] = [];
    if (!message) return result;

    let text = "";
    let key = 0;

    for (const data of graphemeSegmenter.segment(message)) {
        if (EMOJI_REGEX.test(data.segment)) {
            if (text) {
                result.push(text);
                text = "";
            }
            result.push(emojiToSpan(data.segment, key));
            key++;
        } else {
            text += data.segment;
        }
    }
    if (text) {
        result.push(text);
    }
    return result;
}

interface EventAnalysis {
    bodyHasEmoji: boolean;
    isHtmlMessage: boolean;
    strippedBody: string;
    safeBody?: string; // safe, sanitised HTML, preferred over `strippedBody` which is fully plaintext
    isFormattedBody: boolean;
}

export interface EventRenderOpts {
    highlightLink?: string;
    disableBigEmoji?: boolean;
    stripReplyFallback?: boolean;
    forComposerQuote?: boolean;
}

function analyseEvent(content: IContent, highlights: Optional<string[]>, opts: EventRenderOpts = {}): EventAnalysis {
    let sanitizeParams = sanitizeHtmlParams;
    if (opts.forComposerQuote) {
        sanitizeParams = composerSanitizeHtmlParams;
    }

    try {
        const isFormattedBody =
            content.format === "org.matrix.custom.html" && typeof content.formatted_body === "string";
        let bodyHasEmoji = false;
        let isHtmlMessage = false;

        let safeBody: string | undefined; // safe, sanitised HTML, preferred over `strippedBody` which is fully plaintext

        // sanitizeHtml can hang if an unclosed HTML tag is thrown at it
        // A search for `<foo` will make the browser crash an alternative would be to escape HTML special characters
        // but that would bring no additional benefit as the highlighter does not work with those special chars
        const safeHighlights = highlights
            ?.filter((highlight: string): boolean => !highlight.includes("<"))
            .map((highlight: string): string => sanitizeHtml(highlight, sanitizeParams));

        let formattedBody = typeof content.formatted_body === "string" ? content.formatted_body : null;
        const plainBody = typeof content.body === "string" ? content.body : "";

        if (opts.stripReplyFallback && formattedBody) formattedBody = stripHTMLReply(formattedBody);
        const strippedBody = opts.stripReplyFallback ? stripPlainReply(plainBody) : plainBody;
        bodyHasEmoji = mightContainEmoji(isFormattedBody ? formattedBody! : plainBody);

        const highlighter = safeHighlights?.length
            ? new HtmlHighlighter("mx_EventTile_searchHighlight", opts.highlightLink)
            : null;

        if (isFormattedBody) {
            if (highlighter) {
                // XXX: We sanitize the HTML whilst also highlighting its text nodes, to avoid accidentally trying
                // to highlight HTML tags themselves. However, this does mean that we don't highlight textnodes which
                // are interrupted by HTML tags (not that we did before) - e.g. foo<span/>bar won't get highlighted
                // by an attempt to search for 'foobar'.  Then again, the search query probably wouldn't work either
                // XXX: hacky bodge to temporarily apply a textFilter to the sanitizeParams structure.
                sanitizeParams.textFilter = function (safeText) {
                    return highlighter.applyHighlights(safeText, safeHighlights!).join("");
                };
            }

            safeBody = sanitizeHtml(formattedBody!, sanitizeParams);
            const phtml = new DOMParser().parseFromString(safeBody, "text/html");
            const isPlainText = phtml.body.innerHTML === phtml.body.textContent;
            isHtmlMessage = !isPlainText;

            if (isHtmlMessage && SettingsStore.getValue("feature_latex_maths")) {
                [...phtml.querySelectorAll<HTMLElement>("div[data-mx-maths], span[data-mx-maths]")].forEach((e) => {
                    e.outerHTML = katex.renderToString(decode(e.getAttribute("data-mx-maths")), {
                        throwOnError: false,
                        displayMode: e.tagName == "DIV",
                        output: "htmlAndMathml",
                    });
                });
                safeBody = phtml.body.innerHTML;
            }
        } else if (highlighter) {
            safeBody = highlighter.applyHighlights(escapeHtml(plainBody), safeHighlights!).join("");
        }

        return { bodyHasEmoji, isHtmlMessage, strippedBody, safeBody, isFormattedBody };
    } finally {
        delete sanitizeParams.textFilter;
    }
}

export function bodyToDiv(
    content: IContent,
    highlights: Optional<string[]>,
    opts: EventRenderOpts = {},
    ref?: React.Ref<HTMLDivElement>,
): ReactNode {
    const { strippedBody, formattedBody, emojiBodyElements, className } = bodyToNode(content, highlights, opts);

    return formattedBody ? (
        <div
            key="body"
            ref={ref}
            className={className}
            dangerouslySetInnerHTML={{ __html: formattedBody }}
            dir="auto"
        />
    ) : (
        <div key="body" ref={ref} className={className} dir="auto">
            {emojiBodyElements || strippedBody}
        </div>
    );
}

export function bodyToSpan(
    content: IContent,
    highlights: Optional<string[]>,
    opts: EventRenderOpts = {},
    ref?: React.Ref<HTMLSpanElement>,
    includeDir = true,
): ReactNode {
    const { strippedBody, formattedBody, emojiBodyElements, className } = bodyToNode(content, highlights, opts);

    return formattedBody ? (
        <span
            key="body"
            ref={ref}
            className={className}
            dangerouslySetInnerHTML={{ __html: formattedBody }}
            dir={includeDir ? "auto" : undefined}
        />
    ) : (
        <span key="body" ref={ref} className={className} dir={includeDir ? "auto" : undefined}>
            {emojiBodyElements || strippedBody}
        </span>
    );
}

interface BodyToNodeReturn {
    strippedBody: string;
    formattedBody?: string;
    emojiBodyElements: JSX.Element[] | undefined;
    className: string;
}

function bodyToNode(content: IContent, highlights: Optional<string[]>, opts: EventRenderOpts = {}): BodyToNodeReturn {
    const eventInfo = analyseEvent(content, highlights, opts);

    let emojiBody = false;
    if (!opts.disableBigEmoji && eventInfo.bodyHasEmoji) {
        const contentBody = eventInfo.safeBody ?? eventInfo.strippedBody;
        let contentBodyTrimmed = contentBody !== undefined ? contentBody.trim() : "";

        // Remove zero width joiner, zero width spaces and other spaces in body
        // text. This ensures that emojis with spaces in between or that are made
        // up of multiple unicode characters are still counted as purely emoji
        // messages.
        contentBodyTrimmed = contentBodyTrimmed.replace(EMOJI_SEPARATOR_REGEX, "");

        const match = BIGEMOJI_REGEX.exec(contentBodyTrimmed);
        emojiBody =
            match?.[0]?.length === contentBodyTrimmed.length &&
            // Prevent user pills expanding for users with only emoji in
            // their username. Permalinks (links in pills) can be any URL
            // now, so we just check for an HTTP-looking thing.
            (eventInfo.strippedBody === eventInfo.safeBody || // replies have the html fallbacks, account for that here
                content.formatted_body === undefined ||
                (!content.formatted_body.includes("http:") && !content.formatted_body.includes("https:")));
    }

    const className = classNames({
        "mx_EventTile_body": true,
        "mx_EventTile_bigEmoji": emojiBody,
        "markdown-body": eventInfo.isHtmlMessage && !emojiBody,
        // Override the global `notranslate` class set by the top-level `matrixchat` div.
        "translate": true,
    });

    let formattedBody = eventInfo.safeBody;
    if (eventInfo.isFormattedBody && eventInfo.bodyHasEmoji && eventInfo.safeBody) {
        // This has to be done after the emojiBody check as to not break big emoji on replies
        formattedBody = formatEmojis(eventInfo.safeBody, true).join("");
    }

    let emojiBodyElements: JSX.Element[] | undefined;
    if (!eventInfo.safeBody && eventInfo.bodyHasEmoji) {
        emojiBodyElements = formatEmojis(eventInfo.strippedBody, false) as JSX.Element[];
    }

    return { strippedBody: eventInfo.strippedBody, formattedBody, emojiBodyElements, className };
}

/**
 * Turn a matrix event body into html
 *
 * content: 'content' of the MatrixEvent
 *
 * highlights: optional list of words to highlight, ordered by longest word first
 *
 * opts.highlightLink: optional href to add to highlighted words
 * opts.disableBigEmoji: optional argument to disable the big emoji class.
 * opts.stripReplyFallback: optional argument specifying the event is a reply and so fallback needs removing
 * opts.forComposerQuote: optional param to lessen the url rewriting done by sanitization, for quoting into composer
 * opts.ref: React ref to attach to any React components returned (not compatible with opts.returnString)
 */
export function bodyToHtml(content: IContent, highlights: Optional<string[]>, opts: EventRenderOpts = {}): string {
    const eventInfo = analyseEvent(content, highlights, opts);

    let formattedBody = eventInfo.safeBody;
    if (eventInfo.isFormattedBody && eventInfo.bodyHasEmoji && formattedBody) {
        // This has to be done after the emojiBody check above as to not break big emoji on replies
        formattedBody = formatEmojis(eventInfo.safeBody, true).join("");
    }

    return formattedBody ?? eventInfo.strippedBody;
}

/**
 * Turn a room topic into html
 * @param topic plain text topic
 * @param htmlTopic optional html topic
 * @param ref React ref to attach to any React components returned
 * @param allowExtendedHtml whether to allow extended HTML tags such as headings and lists
 * @return The HTML-ified node.
 */
export function topicToHtml(
    topic?: string,
    htmlTopic?: string,
    ref?: LegacyRef<HTMLSpanElement>,
    allowExtendedHtml = false,
): ReactNode {
    if (!SettingsStore.getValue("feature_html_topic")) {
        htmlTopic = undefined;
    }

    let isFormattedTopic = !!htmlTopic;
    let topicHasEmoji = false;
    let safeTopic = "";

    try {
        topicHasEmoji = mightContainEmoji(isFormattedTopic ? htmlTopic! : topic);

        if (isFormattedTopic) {
            safeTopic = sanitizeHtml(htmlTopic!, allowExtendedHtml ? sanitizeHtmlParams : topicSanitizeHtmlParams);
            if (topicHasEmoji) {
                safeTopic = formatEmojis(safeTopic, true).join("");
            }
        }
    } catch {
        isFormattedTopic = false; // Fall back to plain-text topic
    }

    let emojiBodyElements: JSX.Element[] | undefined;
    if (!isFormattedTopic && topicHasEmoji) {
        emojiBodyElements = formatEmojis(topic, false);
    }

    if (isFormattedTopic) {
        if (!safeTopic) return null;
        return <span ref={ref} dangerouslySetInnerHTML={{ __html: safeTopic }} dir="auto" />;
    }

    if (!emojiBodyElements && !topic) return null;
    return (
        <span ref={ref} dir="auto">
            {emojiBodyElements || topic}
        </span>
    );
}

/**
 * Returns if a node is a block element or not.
 * Only takes html nodes into account that are allowed in matrix messages.
 *
 * @param {Node} node
 * @returns {bool}
 */
export function checkBlockNode(node: Node): boolean {
    switch (node.nodeName) {
        case "H1":
        case "H2":
        case "H3":
        case "H4":
        case "H5":
        case "H6":
        case "PRE":
        case "BLOCKQUOTE":
        case "P":
        case "UL":
        case "OL":
        case "LI":
        case "HR":
        case "TABLE":
        case "THEAD":
        case "TBODY":
        case "TR":
        case "TH":
        case "TD":
            return true;
        case "DIV":
            // don't treat math nodes as block nodes for deserializing
            return !(node as HTMLElement).hasAttribute("data-mx-maths");
        default:
            return false;
    }
}
