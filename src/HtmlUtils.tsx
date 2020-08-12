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

import React from 'react';
import sanitizeHtml from 'sanitize-html';
import * as linkify from 'linkifyjs';
import linkifyMatrix from './linkify-matrix';
import _linkifyElement from 'linkifyjs/element';
import _linkifyString from 'linkifyjs/string';
import classNames from 'classnames';
import EMOJIBASE_REGEX from 'emojibase-regex';
import url from 'url';

import {MatrixClientPeg} from './MatrixClientPeg';
import {tryTransformPermalinkToLocalHref} from "./utils/permalinks/Permalinks";
import {SHORTCODE_TO_EMOJI, getEmojiFromUnicode} from "./emoji";
import ReplyThread from "./components/views/elements/ReplyThread";

linkifyMatrix(linkify);

// Anything outside the basic multilingual plane will be a surrogate pair
const SURROGATE_PAIR_PATTERN = /([\ud800-\udbff])([\udc00-\udfff])/;
// And there a bunch more symbol characters that emojibase has within the
// BMP, so this includes the ranges from 'letterlike symbols' to
// 'miscellaneous symbols and arrows' which should catch all of them
// (with plenty of false positives, but that's OK)
const SYMBOL_PATTERN = /([\u2100-\u2bff])/;

// Regex pattern for Zero-Width joiner unicode characters
const ZWJ_REGEX = new RegExp("\u200D|\u2003", "g");

// Regex pattern for whitespace characters
const WHITESPACE_REGEX = new RegExp("\\s", "g");

const BIGEMOJI_REGEX = new RegExp(`^(${EMOJIBASE_REGEX.source})+$`, 'i');

const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

const PERMITTED_URL_SCHEMES = ['http', 'https', 'ftp', 'mailto', 'magnet'];

/*
 * Return true if the given string contains emoji
 * Uses a much, much simpler regex than emojibase's so will give false
 * positives, but useful for fast-path testing strings to see if they
 * need emojification.
 * unicodeToImage uses this function.
 */
function mightContainEmoji(str: string) {
    return SURROGATE_PAIR_PATTERN.test(str) || SYMBOL_PATTERN.test(str);
}

/**
 * Returns the shortcode for an emoji character.
 *
 * @param {String} char The emoji character
 * @return {String} The shortcode (such as :thumbup:)
 */
export function unicodeToShortcode(char: string) {
    const data = getEmojiFromUnicode(char);
    return (data && data.shortcodes ? `:${data.shortcodes[0]}:` : '');
}

/**
 * Returns the unicode character for an emoji shortcode
 *
 * @param {String} shortcode The shortcode (such as :thumbup:)
 * @return {String} The emoji character; null if none exists
 */
export function shortcodeToUnicode(shortcode: string) {
    shortcode = shortcode.slice(1, shortcode.length - 1);
    const data = SHORTCODE_TO_EMOJI.get(shortcode);
    return data ? data.unicode : null;
}

export function processHtmlForSending(html: string): string {
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = html;

    if (contentDiv.children.length === 0) {
        return contentDiv.innerHTML;
    }

    let contentHTML = "";
    for (let i = 0; i < contentDiv.children.length; i++) {
        const element = contentDiv.children[i];
        if (element.tagName.toLowerCase() === 'p') {
            contentHTML += element.innerHTML;
            // Don't add a <br /> for the last <p>
            if (i !== contentDiv.children.length - 1) {
                contentHTML += '<br />';
            }
        } else {
            const temp = document.createElement('div');
            temp.appendChild(element.cloneNode(true));
            contentHTML += temp.innerHTML;
        }
    }

    return contentHTML;
}

/*
 * Given an untrusted HTML string, return a React node with an sanitized version
 * of that HTML.
 */
export function sanitizedHtmlNode(insaneHtml: string) {
    const saneHtml = sanitizeHtml(insaneHtml, sanitizeHtmlParams);

    return <div dangerouslySetInnerHTML={{ __html: saneHtml }} dir="auto" />;
}

export function sanitizedHtmlNodeInnerText(insaneHtml: string) {
    const saneHtml = sanitizeHtml(insaneHtml, sanitizeHtmlParams);
    const contentDiv = document.createElement("div");
    contentDiv.innerHTML = saneHtml;
    return contentDiv.innerText;
}

/**
 * Tests if a URL from an untrusted source may be safely put into the DOM
 * The biggest threat here is javascript: URIs.
 * Note that the HTML sanitiser library has its own internal logic for
 * doing this, to which we pass the same list of schemes. This is used in
 * other places we need to sanitise URLs.
 * @return true if permitted, otherwise false
 */
export function isUrlPermitted(inputUrl: string) {
    try {
        const parsed = url.parse(inputUrl);
        if (!parsed.protocol) return false;
        // URL parser protocol includes the trailing colon
        return PERMITTED_URL_SCHEMES.includes(parsed.protocol.slice(0, -1));
    } catch (e) {
        return false;
    }
}

const transformTags: sanitizeHtml.IOptions["transformTags"] = { // custom to matrix
    // add blank targets to all hyperlinks except vector URLs
    'a': function(tagName: string, attribs: sanitizeHtml.Attributes) {
        if (attribs.href) {
            attribs.target = '_blank'; // by default

            const transformed = tryTransformPermalinkToLocalHref(attribs.href);
            if (transformed !== attribs.href || attribs.href.match(linkifyMatrix.VECTOR_URL_PATTERN)) {
                attribs.href = transformed;
                delete attribs.target;
            }
        }
        attribs.rel = 'noreferrer noopener'; // https://mathiasbynens.github.io/rel-noopener/
        return { tagName, attribs };
    },
    'img': function(tagName: string, attribs: sanitizeHtml.Attributes) {
        // Strip out imgs that aren't `mxc` here instead of using allowedSchemesByTag
        // because transformTags is used _before_ we filter by allowedSchemesByTag and
        // we don't want to allow images with `https?` `src`s.
        if (!attribs.src || !attribs.src.startsWith('mxc://')) {
            return { tagName, attribs: {}};
        }
        attribs.src = MatrixClientPeg.get().mxcUrlToHttp(
            attribs.src,
            attribs.width || 800,
            attribs.height || 600,
        );
        return { tagName, attribs };
    },
    'code': function(tagName: string, attribs: sanitizeHtml.Attributes) {
        if (typeof attribs.class !== 'undefined') {
            // Filter out all classes other than ones starting with language- for syntax highlighting.
            const classes = attribs.class.split(/\s/).filter(function(cl) {
                return cl.startsWith('language-') && !cl.startsWith('language-_');
            });
            attribs.class = classes.join(' ');
        }
        return { tagName, attribs };
    },
    '*': function(tagName: string, attribs: sanitizeHtml.Attributes) {
        // Delete any style previously assigned, style is an allowedTag for font and span
        // because attributes are stripped after transforming
        delete attribs.style;

        // Sanitise and transform data-mx-color and data-mx-bg-color to their CSS
        // equivalents
        const customCSSMapper = {
            'data-mx-color': 'color',
            'data-mx-bg-color': 'background-color',
            // $customAttributeKey: $cssAttributeKey
        };

        let style = "";
        Object.keys(customCSSMapper).forEach((customAttributeKey) => {
            const cssAttributeKey = customCSSMapper[customAttributeKey];
            const customAttributeValue = attribs[customAttributeKey];
            if (customAttributeValue &&
                typeof customAttributeValue === 'string' &&
                COLOR_REGEX.test(customAttributeValue)
            ) {
                style += cssAttributeKey + ":" + customAttributeValue + ";";
                delete attribs[customAttributeKey];
            }
        });

        if (style) {
            attribs.style = style;
        }

        return { tagName, attribs };
    },
};

const sanitizeHtmlParams: sanitizeHtml.IOptions = {
    allowedTags: [
        'font', // custom to matrix for IRC-style font coloring
        'del', // for markdown
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol', 'sup', 'sub',
        'nl', 'li', 'b', 'i', 'u', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
        'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'span', 'img',
    ],
    allowedAttributes: {
        // custom ones first:
        font: ['color', 'data-mx-bg-color', 'data-mx-color', 'style'], // custom to matrix
        span: ['data-mx-bg-color', 'data-mx-color', 'data-mx-spoiler', 'style'], // custom to matrix
        a: ['href', 'name', 'target', 'rel'], // remote target: custom to matrix
        img: ['src', 'width', 'height', 'alt', 'title'],
        ol: ['start'],
        code: ['class'], // We don't actually allow all classes, we filter them in transformTags
    },
    // Lots of these won't come up by default because we don't allow them
    selfClosing: ['img', 'br', 'hr', 'area', 'base', 'basefont', 'input', 'link', 'meta'],
    // URL schemes we permit
    allowedSchemes: PERMITTED_URL_SCHEMES,

    allowProtocolRelative: false,
    transformTags,
};

// this is the same as the above except with less rewriting
const composerSanitizeHtmlParams: sanitizeHtml.IOptions = {
    ...sanitizeHtmlParams,
    transformTags: {
        'code': transformTags['code'],
        '*': transformTags['*'],
    },
};

abstract class BaseHighlighter<T extends React.ReactNode> {
    constructor(public highlightClass: string, public highlightLink: string) {
    }

    /**
     * apply the highlights to a section of text
     *
     * @param {string} safeSnippet The snippet of text to apply the highlights
     *     to.
     * @param {string[]} safeHighlights A list of substrings to highlight,
     *     sorted by descending length.
     *
     * returns a list of results (strings for HtmlHighligher, react nodes for
     * TextHighlighter).
     */
    public applyHighlights(safeSnippet: string, safeHighlights: string[]): T[] {
        let lastOffset = 0;
        let offset;
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

class TextHighlighter extends BaseHighlighter<React.ReactNode> {
    private key = 0;

    /* create a <span> node to hold the given content
     *
     * snippet: content of the span
     * highlight: true to highlight as a search match
     *
     * returns a React node
     */
    protected processSnippet(snippet: string, highlight: boolean): React.ReactNode {
        const key = this.key++;

        let node = <span key={key} className={highlight ? this.highlightClass : null}>
            { snippet }
        </span>;

        if (highlight && this.highlightLink) {
            node = <a key={key} href={this.highlightLink}>{ node }</a>;
        }

        return node;
    }
}

interface IContent {
    format?: string;
    formatted_body?: string;
    body: string;
}

interface IOpts {
    highlightLink?: string;
    disableBigEmoji?: boolean;
    stripReplyFallback?: boolean;
    returnString?: boolean;
    forComposerQuote?: boolean;
    ref?: React.Ref<any>;
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
export function bodyToHtml(content: IContent, highlights: string[], opts: IOpts = {}) {
    const isHtmlMessage = content.format === "org.matrix.custom.html" && content.formatted_body;
    let bodyHasEmoji = false;

    let sanitizeParams = sanitizeHtmlParams;
    if (opts.forComposerQuote) {
        sanitizeParams = composerSanitizeHtmlParams;
    }

    let strippedBody: string;
    let safeBody: string;
    let isDisplayedWithHtml: boolean;
    // XXX: We sanitize the HTML whilst also highlighting its text nodes, to avoid accidentally trying
    // to highlight HTML tags themselves.  However, this does mean that we don't highlight textnodes which
    // are interrupted by HTML tags (not that we did before) - e.g. foo<span/>bar won't get highlighted
    // by an attempt to search for 'foobar'.  Then again, the search query probably wouldn't work either
    try {
        if (highlights && highlights.length > 0) {
            const highlighter = new HtmlHighlighter("mx_EventTile_searchHighlight", opts.highlightLink);
            const safeHighlights = highlights.map(function(highlight) {
                return sanitizeHtml(highlight, sanitizeParams);
            });
            // XXX: hacky bodge to temporarily apply a textFilter to the sanitizeParams structure.
            sanitizeParams.textFilter = function(safeText) {
                return highlighter.applyHighlights(safeText, safeHighlights).join('');
            };
        }

        let formattedBody = typeof content.formatted_body === 'string' ? content.formatted_body : null;
        const plainBody = typeof content.body === 'string' ? content.body : "";

        if (opts.stripReplyFallback && formattedBody) formattedBody = ReplyThread.stripHTMLReply(formattedBody);
        strippedBody = opts.stripReplyFallback ? ReplyThread.stripPlainReply(plainBody) : plainBody;

        bodyHasEmoji = mightContainEmoji(isHtmlMessage ? formattedBody : plainBody);

        // Only generate safeBody if the message was sent as org.matrix.custom.html
        if (isHtmlMessage) {
            isDisplayedWithHtml = true;
            safeBody = sanitizeHtml(formattedBody, sanitizeParams);
        }
    } finally {
        delete sanitizeParams.textFilter;
    }

    if (opts.returnString) {
        return isDisplayedWithHtml ? safeBody : strippedBody;
    }

    let emojiBody = false;
    if (!opts.disableBigEmoji && bodyHasEmoji) {
        let contentBodyTrimmed = strippedBody !== undefined ? strippedBody.trim() : '';

        // Ignore spaces in body text. Emojis with spaces in between should
        // still be counted as purely emoji messages.
        contentBodyTrimmed = contentBodyTrimmed.replace(WHITESPACE_REGEX, '');

        // Remove zero width joiner characters from emoji messages. This ensures
        // that emojis that are made up of multiple unicode characters are still
        // presented as large.
        contentBodyTrimmed = contentBodyTrimmed.replace(ZWJ_REGEX, '');

        const match = BIGEMOJI_REGEX.exec(contentBodyTrimmed);
        emojiBody = match && match[0] && match[0].length === contentBodyTrimmed.length &&
                    // Prevent user pills expanding for users with only emoji in
                    // their username. Permalinks (links in pills) can be any URL
                    // now, so we just check for an HTTP-looking thing.
                    (
                        strippedBody === safeBody || // replies have the html fallbacks, account for that here
                        content.formatted_body === undefined ||
                        (!content.formatted_body.includes("http:") &&
                        !content.formatted_body.includes("https:"))
                    );
    }

    const className = classNames({
        'mx_EventTile_body': true,
        'mx_EventTile_bigEmoji': emojiBody,
        'markdown-body': isHtmlMessage && !emojiBody,
    });

    return isDisplayedWithHtml ?
        <span key="body" ref={opts.ref} className={className} dangerouslySetInnerHTML={{ __html: safeBody }} dir="auto" /> :
        <span key="body" ref={opts.ref} className={className} dir="auto">{ strippedBody }</span>;
}

/**
 * Linkifies the given string. This is a wrapper around 'linkifyjs/string'.
 *
 * @param {string} str string to linkify
 * @param {object} [options] Options for linkifyString. Default: linkifyMatrix.options
 * @returns {string} Linkified string
 */
export function linkifyString(str: string, options = linkifyMatrix.options) {
    return _linkifyString(str, options);
}

/**
 * Linkifies the given DOM element. This is a wrapper around 'linkifyjs/element'.
 *
 * @param {object} element DOM element to linkify
 * @param {object} [options] Options for linkifyElement. Default: linkifyMatrix.options
 * @returns {object}
 */
export function linkifyElement(element: HTMLElement, options = linkifyMatrix.options) {
    return _linkifyElement(element, options);
}

/**
 * Linkify the given string and sanitize the HTML afterwards.
 *
 * @param {string} dirtyHtml The HTML string to sanitize and linkify
 * @param {object} [options] Options for linkifyString. Default: linkifyMatrix.options
 * @returns {string}
 */
export function linkifyAndSanitizeHtml(dirtyHtml: string, options = linkifyMatrix.options) {
    return sanitizeHtml(linkifyString(dirtyHtml, options), sanitizeHtmlParams);
}

/**
 * Returns if a node is a block element or not.
 * Only takes html nodes into account that are allowed in matrix messages.
 *
 * @param {Node} node
 * @returns {bool}
 */
export function checkBlockNode(node: Node) {
    switch (node.nodeName) {
        case "H1":
        case "H2":
        case "H3":
        case "H4":
        case "H5":
        case "H6":
        case "PRE":
        case "BLOCKQUOTE":
        case "DIV":
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
        default:
            return false;
    }
}
