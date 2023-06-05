/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { LegacyRef, ReactElement, ReactNode } from "react";
import sanitizeHtml from "sanitize-html";
import classNames from "classnames";
import EMOJIBASE_REGEX from "emojibase-regex";
import { merge } from "lodash";
import katex from "katex";
import { decode } from "html-entities";
import { IContent } from "matrix-js-sdk/src/models/event";
import { Optional } from "matrix-events-sdk";
import _Linkify from "linkify-react";
import escapeHtml from "escape-html";
import GraphemeSplitter from "graphemer";

import {
    _linkifyElement,
    _linkifyString,
    ELEMENT_URL_PATTERN,
    options as linkifyMatrixOptions,
} from "./linkify-matrix";
import { IExtendedSanitizeOptions } from "./@types/sanitize-html";
import SettingsStore from "./settings/SettingsStore";
import { tryTransformPermalinkToLocalHref } from "./utils/permalinks/Permalinks";
import { getEmojiFromUnicode } from "./emoji";
import { mediaFromMxc } from "./customisations/Media";
import { stripHTMLReply, stripPlainReply } from "./utils/Reply";

// Anything outside the basic multilingual plane will be a surrogate pair
const SURROGATE_PAIR_PATTERN = /([\ud800-\udbff])([\udc00-\udfff])/;
// And there a bunch more symbol characters that emojibase has within the
// BMP, so this includes the ranges from 'letterlike symbols' to
// 'miscellaneous symbols and arrows' which should catch all of them
// (with plenty of false positives, but that's OK)
const SYMBOL_PATTERN = /([\u2100-\u2bff])/;

// Regex pattern for non-emoji characters that can appear in an "all-emoji" message (Zero-Width Joiner, Zero-Width Space, other whitespace)
const EMOJI_SEPARATOR_REGEX = /[\u200D\u200B\s]/g;

const BIGEMOJI_REGEX = new RegExp(`^(${EMOJIBASE_REGEX.source})+$`, "i");

const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export const PERMITTED_URL_SCHEMES = [
    "bitcoin",
    "ftp",
    "geo",
    "http",
    "https",
    "im",
    "irc",
    "ircs",
    "magnet",
    "mailto",
    "matrix",
    "mms",
    "news",
    "nntp",
    "openpgp4fpr",
    "sip",
    "sftp",
    "sms",
    "smsto",
    "ssh",
    "tel",
    "urn",
    "webcal",
    "wtai",
    "xmpp",
];

const MEDIA_API_MXC_REGEX = /\/_matrix\/media\/r0\/(?:download|thumbnail)\/(.+?)\/(.+?)(?:[?/]|$)/;

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
    } catch (e) {
        return false;
    }
}

const transformTags: IExtendedSanitizeOptions["transformTags"] = {
    // custom to matrix
    // add blank targets to all hyperlinks except vector URLs
    "a": function (tagName: string, attribs: sanitizeHtml.Attributes) {
        if (attribs.href) {
            attribs.target = "_blank"; // by default

            const transformed = tryTransformPermalinkToLocalHref(attribs.href); // only used to check if it is a link that can be handled locally
            if (
                transformed !== attribs.href || // it could be converted so handle locally symbols e.g. @user:server.tdl, matrix: and matrix.to
                attribs.href.match(ELEMENT_URL_PATTERN) // for https links to Element domains
            ) {
                delete attribs.target;
            }
        } else {
            // Delete the href attrib if it is falsy
            delete attribs.href;
        }

        attribs.rel = "noreferrer noopener"; // https://mathiasbynens.github.io/rel-noopener/
        return { tagName, attribs };
    },
    "img": function (tagName: string, attribs: sanitizeHtml.Attributes) {
        let src = attribs.src;
        // Strip out imgs that aren't `mxc` here instead of using allowedSchemesByTag
        // because transformTags is used _before_ we filter by allowedSchemesByTag and
        // we don't want to allow images with `https?` `src`s.
        // We also drop inline images (as if they were not present at all) when the "show
        // images" preference is disabled. Future work might expose some UI to reveal them
        // like standalone image events have.
        if (!src || !SettingsStore.getValue("showImages")) {
            return { tagName, attribs: {} };
        }

        if (!src.startsWith("mxc://")) {
            const match = MEDIA_API_MXC_REGEX.exec(src);
            if (match) {
                src = `mxc://${match[1]}/${match[2]}`;
            }
        }

        if (!src.startsWith("mxc://")) {
            return { tagName, attribs: {} };
        }

        const requestedWidth = Number(attribs.width);
        const requestedHeight = Number(attribs.height);
        const width = Math.min(requestedWidth || 800, 800);
        const height = Math.min(requestedHeight || 600, 600);
        // specify width/height as max values instead of absolute ones to allow object-fit to do its thing
        // we only allow our own styles for this tag so overwrite the attribute
        attribs.style = `max-width: ${width}px; max-height: ${height}px;`;
        if (requestedWidth) {
            attribs.style += "width: 100%;";
        }
        if (requestedHeight) {
            attribs.style += "height: 100%;";
        }

        attribs.src = mediaFromMxc(src).getThumbnailOfSourceHttp(width, height)!;
        return { tagName, attribs };
    },
    "code": function (tagName: string, attribs: sanitizeHtml.Attributes) {
        if (typeof attribs.class !== "undefined") {
            // Filter out all classes other than ones starting with language- for syntax highlighting.
            const classes = attribs.class.split(/\s/).filter(function (cl) {
                return cl.startsWith("language-") && !cl.startsWith("language-_");
            });
            attribs.class = classes.join(" ");
        }
        return { tagName, attribs };
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "*": function (tagName: string, attribs: sanitizeHtml.Attributes) {
        // Delete any style previously assigned, style is an allowedTag for font, span & img,
        // because attributes are stripped after transforming.
        // For img this is trusted as it is generated wholly within the img transformation method.
        if (tagName !== "img") {
            delete attribs.style;
        }

        // Sanitise and transform data-mx-color and data-mx-bg-color to their CSS
        // equivalents
        const customCSSMapper: Record<string, string> = {
            "data-mx-color": "color",
            "data-mx-bg-color": "background-color",
            // $customAttributeKey: $cssAttributeKey
        };

        let style = "";
        Object.keys(customCSSMapper).forEach((customAttributeKey) => {
            const cssAttributeKey = customCSSMapper[customAttributeKey];
            const customAttributeValue = attribs[customAttributeKey];
            if (
                customAttributeValue &&
                typeof customAttributeValue === "string" &&
                COLOR_REGEX.test(customAttributeValue)
            ) {
                style += cssAttributeKey + ":" + customAttributeValue + ";";
                delete attribs[customAttributeKey];
            }
        });

        if (style) {
            attribs.style = style + (attribs.style || "");
        }

        return { tagName, attribs };
    },
};

const sanitizeHtmlParams: IExtendedSanitizeOptions = {
    allowedTags: [
        "font", // custom to matrix for IRC-style font coloring
        "del", // for markdown
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
    ],
    allowedAttributes: {
        // attribute sanitization happens after transformations, so we have to accept `style` for font, span & img
        // but strip during the transformation.
        // custom ones first:
        font: ["color", "data-mx-bg-color", "data-mx-color", "style"], // custom to matrix
        span: ["data-mx-maths", "data-mx-bg-color", "data-mx-color", "data-mx-spoiler", "style"], // custom to matrix
        div: ["data-mx-maths"],
        a: ["href", "name", "target", "rel"], // remote target: custom to matrix
        // img tags also accept width/height, we just map those to max-width & max-height during transformation
        img: ["src", "alt", "title", "style"],
        ol: ["start"],
        code: ["class"], // We don't actually allow all classes, we filter them in transformTags
    },
    // Lots of these won't come up by default because we don't allow them
    selfClosing: ["img", "br", "hr", "area", "base", "basefont", "input", "link", "meta"],
    // URL schemes we permit
    allowedSchemes: PERMITTED_URL_SCHEMES,
    allowProtocolRelative: false,
    transformTags,
    // 50 levels deep "should be enough for anyone"
    nestingLimit: 50,
};

// this is the same as the above except with less rewriting
const composerSanitizeHtmlParams: IExtendedSanitizeOptions = {
    ...sanitizeHtmlParams,
    transformTags: {
        "code": transformTags["code"],
        "*": transformTags["*"],
    },
};

// reduced set of allowed tags to avoid turning topics into Myspace
const topicSanitizeHtmlParams: IExtendedSanitizeOptions = {
    ...sanitizeHtmlParams,
    allowedTags: [
        "font", // custom to matrix for IRC-style font coloring
        "del", // for markdown
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
    public constructor(public highlightClass: string, public highlightLink?: string) {}

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

interface IOpts {
    highlightLink?: string;
    disableBigEmoji?: boolean;
    stripReplyFallback?: boolean;
    returnString?: boolean;
    forComposerQuote?: boolean;
    ref?: React.Ref<HTMLSpanElement>;
}

export interface IOptsReturnNode extends IOpts {
    returnString?: false | undefined;
}

export interface IOptsReturnString extends IOpts {
    returnString: true;
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
export function formatEmojis(message: string | undefined, isHtmlMessage: boolean): (JSX.Element | string)[] {
    const emojiToSpan = isHtmlMessage ? emojiToHtmlSpan : emojiToJsxSpan;
    const result: (JSX.Element | string)[] = [];
    if (!message) return result;

    let text = "";
    let key = 0;

    const splitter = new GraphemeSplitter();
    for (const char of splitter.iterateGraphemes(message)) {
        if (EMOJIBASE_REGEX.test(char)) {
            if (text) {
                result.push(text);
                text = "";
            }
            result.push(emojiToSpan(char, key));
            key++;
        } else {
            text += char;
        }
    }
    if (text) {
        result.push(text);
    }
    return result;
}

/* turn a matrix event body into html
 *
 * content: 'content' of the MatrixEvent
 *
 * highlights: optional list of words to highlight, ordered by longest word first
 *
 * opts.highlightLink: optional href to add to highlighted words
 * opts.disableBigEmoji: optional argument to disable the big emoji class.
 * opts.stripReplyFallback: optional argument specifying the event is a reply and so fallback needs removing
 * opts.returnString: return an HTML string rather than JSX elements
 * opts.forComposerQuote: optional param to lessen the url rewriting done by sanitization, for quoting into composer
 * opts.ref: React ref to attach to any React components returned (not compatible with opts.returnString)
 */
export function bodyToHtml(content: IContent, highlights: Optional<string[]>, opts: IOptsReturnString): string;
export function bodyToHtml(content: IContent, highlights: Optional<string[]>, opts: IOptsReturnNode): ReactNode;
export function bodyToHtml(content: IContent, highlights: Optional<string[]>, opts: IOpts = {}): ReactNode | string {
    const isFormattedBody = content.format === "org.matrix.custom.html" && typeof content.formatted_body === "string";
    let bodyHasEmoji = false;
    let isHtmlMessage = false;

    let sanitizeParams = sanitizeHtmlParams;
    if (opts.forComposerQuote) {
        sanitizeParams = composerSanitizeHtmlParams;
    }

    let strippedBody: string;
    let safeBody: string | undefined; // safe, sanitised HTML, preferred over `strippedBody` which is fully plaintext

    try {
        // sanitizeHtml can hang if an unclosed HTML tag is thrown at it
        // A search for `<foo` will make the browser crash an alternative would be to escape HTML special characters
        // but that would bring no additional benefit as the highlighter does not work with those special chars
        const safeHighlights = highlights
            ?.filter((highlight: string): boolean => !highlight.includes("<"))
            .map((highlight: string): string => sanitizeHtml(highlight, sanitizeParams));

        let formattedBody = typeof content.formatted_body === "string" ? content.formatted_body : null;
        const plainBody = typeof content.body === "string" ? content.body : "";

        if (opts.stripReplyFallback && formattedBody) formattedBody = stripHTMLReply(formattedBody);
        strippedBody = opts.stripReplyFallback ? stripPlainReply(plainBody) : plainBody;
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
                [...phtml.querySelectorAll<HTMLElement>("div, span[data-mx-maths]")].forEach((e) => {
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
    } finally {
        delete sanitizeParams.textFilter;
    }

    let emojiBody = false;
    if (!opts.disableBigEmoji && bodyHasEmoji) {
        const contentBody = safeBody ?? strippedBody;
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
            (strippedBody === safeBody || // replies have the html fallbacks, account for that here
                content.formatted_body === undefined ||
                (!content.formatted_body.includes("http:") && !content.formatted_body.includes("https:")));
    }

    if (isFormattedBody && bodyHasEmoji && safeBody) {
        // This has to be done after the emojiBody check above as to not break big emoji on replies
        safeBody = formatEmojis(safeBody, true).join("");
    }

    if (opts.returnString) {
        return safeBody ?? strippedBody;
    }

    const className = classNames({
        "mx_EventTile_body": true,
        "mx_EventTile_bigEmoji": emojiBody,
        "markdown-body": isHtmlMessage && !emojiBody,
    });

    let emojiBodyElements: JSX.Element[] | undefined;
    if (!safeBody && bodyHasEmoji) {
        emojiBodyElements = formatEmojis(strippedBody, false) as JSX.Element[];
    }

    return safeBody ? (
        <span
            key="body"
            ref={opts.ref}
            className={className}
            dangerouslySetInnerHTML={{ __html: safeBody }}
            dir="auto"
        />
    ) : (
        <span key="body" ref={opts.ref} className={className} dir="auto">
            {emojiBodyElements || strippedBody}
        </span>
    );
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

    return isFormattedTopic ? (
        <span ref={ref} dangerouslySetInnerHTML={{ __html: safeTopic }} dir="auto" />
    ) : (
        <span ref={ref} dir="auto">
            {emojiBodyElements || topic}
        </span>
    );
}

/* Wrapper around linkify-react merging in our default linkify options */
export function Linkify({ as, options, children }: React.ComponentProps<typeof _Linkify>): ReactElement {
    return (
        <_Linkify as={as} options={merge({}, linkifyMatrixOptions, options)}>
            {children}
        </_Linkify>
    );
}

/**
 * Linkifies the given string. This is a wrapper around 'linkifyjs/string'.
 *
 * @param {string} str string to linkify
 * @param {object} [options] Options for linkifyString. Default: linkifyMatrixOptions
 * @returns {string} Linkified string
 */
export function linkifyString(str: string, options = linkifyMatrixOptions): string {
    return _linkifyString(str, options);
}

/**
 * Linkifies the given DOM element. This is a wrapper around 'linkifyjs/element'.
 *
 * @param {object} element DOM element to linkify
 * @param {object} [options] Options for linkifyElement. Default: linkifyMatrixOptions
 * @returns {object}
 */
export function linkifyElement(element: HTMLElement, options = linkifyMatrixOptions): HTMLElement {
    return _linkifyElement(element, options);
}

/**
 * Linkify the given string and sanitize the HTML afterwards.
 *
 * @param {string} dirtyHtml The HTML string to sanitize and linkify
 * @param {object} [options] Options for linkifyString. Default: linkifyMatrixOptions
 * @returns {string}
 */
export function linkifyAndSanitizeHtml(dirtyHtml: string, options = linkifyMatrixOptions): string {
    return sanitizeHtml(linkifyString(dirtyHtml, options), sanitizeHtmlParams);
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
