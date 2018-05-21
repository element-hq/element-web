/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 New Vector Ltd

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

'use strict';

import ReplyThread from "./components/views/elements/ReplyThread";

const React = require('react');
const sanitizeHtml = require('sanitize-html');
const highlight = require('highlight.js');
const linkifyMatrix = require('./linkify-matrix');
import escape from 'lodash/escape';
import emojione from 'emojione';
import classNames from 'classnames';
import MatrixClientPeg from './MatrixClientPeg';
import url from 'url';

emojione.imagePathSVG = 'emojione/svg/';
// Store PNG path for displaying many flags at once (for increased performance over SVG)
emojione.imagePathPNG = 'emojione/png/';
// Use SVGs for emojis
emojione.imageType = 'svg';

// Anything outside the basic multilingual plane will be a surrogate pair
const SURROGATE_PAIR_PATTERN = /([\ud800-\udbff])([\udc00-\udfff])/;
// And there a bunch more symbol characters that emojione has within the
// BMP, so this includes the ranges from 'letterlike symbols' to
// 'miscellaneous symbols and arrows' which should catch all of them
// (with plenty of false positives, but that's OK)
const SYMBOL_PATTERN = /([\u2100-\u2bff])/;

// And this is emojione's complete regex
const EMOJI_REGEX = new RegExp(emojione.unicodeRegexp+"+", "gi");
const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

const PERMITTED_URL_SCHEMES = ['http', 'https', 'ftp', 'mailto', 'magnet'];

/*
 * Return true if the given string contains emoji
 * Uses a much, much simpler regex than emojione's so will give false
 * positives, but useful for fast-path testing strings to see if they
 * need emojification.
 * unicodeToImage uses this function.
 */
export function containsEmoji(str) {
    return SURROGATE_PAIR_PATTERN.test(str) || SYMBOL_PATTERN.test(str);
}

/* modified from https://github.com/Ranks/emojione/blob/master/lib/js/emojione.js
 * because we want to include emoji shortnames in title text
 */
function unicodeToImage(str) {
    let replaceWith, unicode, alt, short, fname;
    const mappedUnicode = emojione.mapUnicodeToShort();

    str = str.replace(emojione.regUnicode, function(unicodeChar) {
        if ( (typeof unicodeChar === 'undefined') || (unicodeChar === '') || (!(unicodeChar in emojione.jsEscapeMap)) ) {
            // if the unicodeChar doesnt exist just return the entire match
            return unicodeChar;
        } else {
            // get the unicode codepoint from the actual char
            unicode = emojione.jsEscapeMap[unicodeChar];

            short = mappedUnicode[unicode];
            fname = emojione.emojioneList[short].fname;

            // depending on the settings, we'll either add the native unicode as the alt tag, otherwise the shortname
            alt = (emojione.unicodeAlt) ? emojione.convert(unicode.toUpperCase()) : mappedUnicode[unicode];
            const title = mappedUnicode[unicode];

            replaceWith = `<img class="mx_emojione" title="${title}" alt="${alt}" src="${emojione.imagePathSVG}${fname}.svg${emojione.cacheBustParam}"/>`;
            return replaceWith;
        }
    });

    return str;
}

/**
 * Given one or more unicode characters (represented by unicode
 * character number), return an image node with the corresponding
 * emoji.
 *
 * @param alt {string} String to use for the image alt text
 * @param useSvg {boolean} Whether to use SVG image src. If False, PNG will be used.
 * @param unicode {integer} One or more integers representing unicode characters
 * @returns A img node with the corresponding emoji
 */
export function charactersToImageNode(alt, useSvg, ...unicode) {
    const fileName = unicode.map((u) => {
        return u.toString(16);
    }).join('-');
    const path = useSvg ? emojione.imagePathSVG : emojione.imagePathPNG;
    const fileType = useSvg ? 'svg' : 'png';
    return <img
        alt={alt}
        src={`${path}${fileName}.${fileType}${emojione.cacheBustParam}`}
    />;
}

/*
export function processHtmlForSending(html: string): string {
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = html;

    if (contentDiv.children.length === 0) {
        return contentDiv.innerHTML;
    }

    let contentHTML = "";
    for (let i=0; i < contentDiv.children.length; i++) {
        const element = contentDiv.children[i];
        if (element.tagName.toLowerCase() === 'p') {
            contentHTML += element.innerHTML;
            // Don't add a <br /> for the last <p>
            if (i !== contentDiv.children.length - 1) {
                contentHTML += '<br />';
            }
        } else if (element.tagName.toLowerCase() === 'pre') {
            // Replace "<br>\n" with "\n" within `<pre>` tags because the <br> is
            // redundant. This is a workaround for a bug in draft-js-export-html:
            //   https://github.com/sstur/draft-js-export-html/issues/62
            contentHTML += '<pre>' +
                element.innerHTML.replace(/<br>\n/g, '\n').trim() +
                '</pre>';
        } else {
            const temp = document.createElement('div');
            temp.appendChild(element.cloneNode(true));
            contentHTML += temp.innerHTML;
        }
    }

    return contentHTML;
}
*/

/*
 * Given an untrusted HTML string, return a React node with an sanitized version
 * of that HTML.
 */
export function sanitizedHtmlNode(insaneHtml) {
    const saneHtml = sanitizeHtml(insaneHtml, sanitizeHtmlParams);

    return <div dangerouslySetInnerHTML={{ __html: saneHtml }} dir="auto" />;
}

/**
 * Tests if a URL from an untrusted source may be safely put into the DOM
 * The biggest threat here is javascript: URIs.
 * Note that the HTML sanitiser library has its own internal logic for
 * doing this, to which we pass the same list of schemes. This is used in
 * other places we need to sanitise URLs.
 * @return true if permitted, otherwise false
 */
export function isUrlPermitted(inputUrl) {
    try {
        const parsed = url.parse(inputUrl);
        if (!parsed.protocol) return false;
        // URL parser protocol includes the trailing colon
        return PERMITTED_URL_SCHEMES.includes(parsed.protocol.slice(0, -1));
    } catch (e) {
        return false;
    }
}

const sanitizeHtmlParams = {
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
        span: ['data-mx-bg-color', 'data-mx-color', 'style'], // custom to matrix
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

    transformTags: { // custom to matrix
        // add blank targets to all hyperlinks except vector URLs
        'a': function(tagName, attribs) {
            if (attribs.href) {
                attribs.target = '_blank'; // by default

                let m;
                // FIXME: horrible duplication with linkify-matrix
                m = attribs.href.match(linkifyMatrix.VECTOR_URL_PATTERN);
                if (m) {
                    attribs.href = m[1];
                    delete attribs.target;
                } else {
                    m = attribs.href.match(linkifyMatrix.MATRIXTO_URL_PATTERN);
                    if (m) {
                        const entity = m[1];
                        if (entity[0] === '@') {
                            attribs.href = '#/user/' + entity;
                        } else if (entity[0] === '#' || entity[0] === '!') {
                            attribs.href = '#/room/' + entity;
                        }
                        delete attribs.target;
                    }
                }
            }
            attribs.rel = 'noopener'; // https://mathiasbynens.github.io/rel-noopener/
            return { tagName: tagName, attribs: attribs };
        },
        'img': function(tagName, attribs) {
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
            return { tagName: tagName, attribs: attribs };
        },
        'code': function(tagName, attribs) {
            if (typeof attribs.class !== 'undefined') {
                // Filter out all classes other than ones starting with language- for syntax highlighting.
                const classes = attribs.class.split(/\s+/).filter(function(cl) {
                    return cl.startsWith('language-');
                });
                attribs.class = classes.join(' ');
            }
            return {
                tagName: tagName,
                attribs: attribs,
            };
        },
        '*': function(tagName, attribs) {
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

            return { tagName: tagName, attribs: attribs };
        },
    },
};

class BaseHighlighter {
    constructor(highlightClass, highlightLink) {
        this.highlightClass = highlightClass;
        this.highlightLink = highlightLink;
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
    applyHighlights(safeSnippet, safeHighlights) {
        let lastOffset = 0;
        let offset;
        let nodes = [];

        const safeHighlight = safeHighlights[0];
        while ((offset = safeSnippet.toLowerCase().indexOf(safeHighlight.toLowerCase(), lastOffset)) >= 0) {
            // handle preamble
            if (offset > lastOffset) {
                var subSnippet = safeSnippet.substring(lastOffset, offset);
                nodes = nodes.concat(this._applySubHighlights(subSnippet, safeHighlights));
            }

            // do highlight. use the original string rather than safeHighlight
            // to preserve the original casing.
            const endOffset = offset + safeHighlight.length;
            nodes.push(this._processSnippet(safeSnippet.substring(offset, endOffset), true));

            lastOffset = endOffset;
        }

        // handle postamble
        if (lastOffset !== safeSnippet.length) {
            subSnippet = safeSnippet.substring(lastOffset, undefined);
            nodes = nodes.concat(this._applySubHighlights(subSnippet, safeHighlights));
        }
        return nodes;
    }

    _applySubHighlights(safeSnippet, safeHighlights) {
        if (safeHighlights[1]) {
            // recurse into this range to check for the next set of highlight matches
            return this.applyHighlights(safeSnippet, safeHighlights.slice(1));
        } else {
            // no more highlights to be found, just return the unhighlighted string
            return [this._processSnippet(safeSnippet, false)];
        }
    }
}

class HtmlHighlighter extends BaseHighlighter {
    /* highlight the given snippet if required
     *
     * snippet: content of the span; must have been sanitised
     * highlight: true to highlight as a search match
     *
     * returns an HTML string
     */
    _processSnippet(snippet, highlight) {
        if (!highlight) {
            // nothing required here
            return snippet;
        }

        let span = "<span class=\""+this.highlightClass+"\">"
            + snippet + "</span>";

        if (this.highlightLink) {
            span = "<a href=\""+encodeURI(this.highlightLink)+"\">"
                +span+"</a>";
        }
        return span;
    }
}

class TextHighlighter extends BaseHighlighter {
    constructor(highlightClass, highlightLink) {
        super(highlightClass, highlightLink);
        this._key = 0;
    }

    /* create a <span> node to hold the given content
     *
     * snippet: content of the span
     * highlight: true to highlight as a search match
     *
     * returns a React node
     */
    _processSnippet(snippet, highlight) {
        const key = this._key++;

        let node =
            <span key={key} className={highlight ? this.highlightClass : null}>
                { snippet }
            </span>;

        if (highlight && this.highlightLink) {
            node = <a key={key} href={this.highlightLink}>{ node }</a>;
        }

        return node;
    }
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
 * opts.emojiOne: optional param to do emojiOne (default true)
 */
export function bodyToHtml(content, highlights, opts={}) {
    const isHtmlMessage = content.format === "org.matrix.custom.html" && content.formatted_body;

    const doEmojiOne = opts.emojiOne === undefined ? true : opts.emojiOne;
    let bodyHasEmoji = false;

    let strippedBody;
    let safeBody;
    let isDisplayedWithHtml;
    // XXX: We sanitize the HTML whilst also highlighting its text nodes, to avoid accidentally trying
    // to highlight HTML tags themselves.  However, this does mean that we don't highlight textnodes which
    // are interrupted by HTML tags (not that we did before) - e.g. foo<span/>bar won't get highlighted
    // by an attempt to search for 'foobar'.  Then again, the search query probably wouldn't work either
    try {
        if (highlights && highlights.length > 0) {
            const highlighter = new HtmlHighlighter("mx_EventTile_searchHighlight", opts.highlightLink);
            const safeHighlights = highlights.map(function(highlight) {
                return sanitizeHtml(highlight, sanitizeHtmlParams);
            });
            // XXX: hacky bodge to temporarily apply a textFilter to the sanitizeHtmlParams structure.
            sanitizeHtmlParams.textFilter = function(safeText) {
                return highlighter.applyHighlights(safeText, safeHighlights).join('');
            };
        }

        let formattedBody = content.formatted_body;
        if (opts.stripReplyFallback && formattedBody) formattedBody = ReplyThread.stripHTMLReply(formattedBody);
        strippedBody = opts.stripReplyFallback ? ReplyThread.stripPlainReply(content.body) : content.body;

        if (doEmojiOne) {
            bodyHasEmoji = containsEmoji(isHtmlMessage ? formattedBody : content.body);
        }

        // Only generate safeBody if the message was sent as org.matrix.custom.html
        if (isHtmlMessage) {
            isDisplayedWithHtml = true;
            safeBody = sanitizeHtml(formattedBody, sanitizeHtmlParams);
        } else {
            // ... or if there are emoji, which we insert as HTML alongside the
            // escaped plaintext body.
            if (bodyHasEmoji) {
                isDisplayedWithHtml = true;
                safeBody = sanitizeHtml(escape(strippedBody), sanitizeHtmlParams);
            }
        }

        // An HTML message with emoji
        //  or a plaintext message with emoji that was escaped and sanitized into
        //  HTML.
        if (bodyHasEmoji) {
            safeBody = unicodeToImage(safeBody);
        }
    } finally {
        delete sanitizeHtmlParams.textFilter;
    }

    if (opts.returnString) {
        return isDisplayedWithHtml ? safeBody : strippedBody;
    }

    let emojiBody = false;
    if (!opts.disableBigEmoji && bodyHasEmoji) {
        EMOJI_REGEX.lastIndex = 0;
        const contentBodyTrimmed = strippedBody !== undefined ? strippedBody.trim() : '';
        const match = EMOJI_REGEX.exec(contentBodyTrimmed);
        emojiBody = match && match[0] && match[0].length === contentBodyTrimmed.length;
    }

    const className = classNames({
        'mx_EventTile_body': true,
        'mx_EventTile_bigEmoji': emojiBody,
        'markdown-body': isHtmlMessage,
    });

    return isDisplayedWithHtml ?
        <span className={className} dangerouslySetInnerHTML={{ __html: safeBody }} dir="auto" /> :
        <span className={className} dir="auto">{ strippedBody }</span>;
}

export function emojifyText(text) {
    return {
        __html: unicodeToImage(escape(text)),
    };
}
