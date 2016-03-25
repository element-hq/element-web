/*
Copyright 2015, 2016 OpenMarket Ltd

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

var React = require('react');
var sanitizeHtml = require('sanitize-html');
var highlight = require('highlight.js');
var linkifyMatrix = require('./linkify-matrix');

var sanitizeHtmlParams = {
    allowedTags: [
        'font', // custom to matrix for IRC-style font coloring
        'del', // for markdown
        // deliberately no h1/h2 to stop people shouting.
        'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
        'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
        'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre'
    ],
    allowedAttributes: {
        // custom ones first:
        font: [ 'color' ], // custom to matrix
        a: [ 'href', 'name', 'target' ], // remote target: custom to matrix
        // We don't currently allow img itself by default, but this
        // would make sense if we did
        img: [ 'src' ],
    },
    // Lots of these won't come up by default because we don't allow them
    selfClosing: [ 'img', 'br', 'hr', 'area', 'base', 'basefont', 'input', 'link', 'meta' ],
    // URL schemes we permit
    allowedSchemes: [ 'http', 'https', 'ftp', 'mailto' ],
    allowedSchemesByTag: {},
    
    transformTags: { // custom to matrix
        // add blank targets to all hyperlinks except vector URLs
        'a': function(tagName, attribs) {
            var m = attribs.href ? attribs.href.match(linkifyMatrix.VECTOR_URL_PATTERN) : null;
            if (m) {
                delete attribs.target;
            }
            else {
                attribs.target = '_blank';
            }
            return { tagName: tagName, attribs : attribs };
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
        var lastOffset = 0;
        var offset;
        var nodes = [];

        var safeHighlight = safeHighlights[0];
        while ((offset = safeSnippet.toLowerCase().indexOf(safeHighlight.toLowerCase(), lastOffset)) >= 0) {
            // handle preamble
            if (offset > lastOffset) {
                var subSnippet = safeSnippet.substring(lastOffset, offset);
                nodes = nodes.concat(this._applySubHighlights(subSnippet, safeHighlights));
            }

            // do highlight. use the original string rather than safeHighlight
            // to preserve the original casing.
            var endOffset = offset + safeHighlight.length;
            nodes.push(this._processSnippet(safeSnippet.substring(offset, endOffset), true));

            lastOffset = endOffset;
        }

        // handle postamble
        if (lastOffset != safeSnippet.length) {
            var subSnippet = safeSnippet.substring(lastOffset, undefined);
            nodes = nodes.concat(this._applySubHighlights(subSnippet, safeHighlights));
        }
        return nodes;
    }

    _applySubHighlights(safeSnippet, safeHighlights) {
        if (safeHighlights[1]) {
            // recurse into this range to check for the next set of highlight matches
            return this.applyHighlights(safeSnippet, safeHighlights.slice(1));
        }
        else {
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

        var span = "<span class=\""+this.highlightClass+"\">"
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
        var key = this._key++;

        var node =
            <span key={key} className={highlight ? this.highlightClass : null }>
                { snippet }
            </span>;

        if (highlight && this.highlightLink) {
            node = <a key={key} href={this.highlightLink}>{node}</a>
        }

        return node;
    }
}


module.exports = {
    /* turn a matrix event body into html
     *
     * content: 'content' of the MatrixEvent
     *
     * highlights: optional list of words to highlight, ordered by longest word first
     *
     * opts.highlightLink: optional href to add to highlights
     */
    bodyToHtml: function(content, highlights, opts) {
        opts = opts || {};

        var isHtml = (content.format === "org.matrix.custom.html");

        var safeBody;
        if (isHtml) {
            // XXX: We sanitize the HTML whilst also highlighting its text nodes, to avoid accidentally trying
            // to highlight HTML tags themselves.  However, this does mean that we don't highlight textnodes which
            // are interrupted by HTML tags (not that we did before) - e.g. foo<span/>bar won't get highlighted
            // by an attempt to search for 'foobar'.  Then again, the search query probably wouldn't work either
            try {
                if (highlights && highlights.length > 0) {
                    var highlighter = new HtmlHighlighter("mx_EventTile_searchHighlight", opts.highlightLink);
                    var safeHighlights = highlights.map(function(highlight) {
                        return sanitizeHtml(highlight, sanitizeHtmlParams);
                    });
                    // XXX: hacky bodge to temporarily apply a textFilter to the sanitizeHtmlParams structure.
                    sanitizeHtmlParams.textFilter = function(safeText) {
                        return highlighter.applyHighlights(safeText, safeHighlights).join('');
                    };
                }
                safeBody = sanitizeHtml(content.formatted_body, sanitizeHtmlParams);
            }
            finally {
                delete sanitizeHtmlParams.textFilter;
            }
            return <span className="markdown-body" dangerouslySetInnerHTML={{ __html: safeBody }} />;
        } else {
            safeBody = content.body;
            if (highlights && highlights.length > 0) {
                var highlighter = new TextHighlighter("mx_EventTile_searchHighlight", opts.highlightLink);
                return highlighter.applyHighlights(safeBody, highlights);
            }
            else {
                return safeBody;
            }
        }
    },

    highlightDom: function(element) {
        var blocks = element.getElementsByTagName("code");
        for (var i = 0; i < blocks.length; i++) {
            highlight.highlightBlock(blocks[i]);
        }
    },

}

