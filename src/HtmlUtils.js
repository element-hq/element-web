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

var sanitizeHtmlParams = {
    allowedTags: [
        'font', // custom to matrix. deliberately no h1/h2 to stop people shouting.
        'del', // for markdown
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
        // add blank targets to all hyperlinks
        'a': sanitizeHtml.simpleTransform('a', { target: '_blank'} )
    },
};

class Highlighter {
    constructor(html, highlightClass, onHighlightClick) {
        this.html = html;
        this.highlightClass = highlightClass;
        this.onHighlightClick = onHighlightClick;
        this._key = 0;
    }

    applyHighlights(safeSnippet, highlights) {
        var lastOffset = 0;
        var offset;
        var nodes = [];

        // XXX: when highlighting HTML, synapse performs the search on the plaintext body,
        // but we're attempting to apply the highlights here to the HTML body.  This is
        // never going to end well - we really should be hooking into the sanitzer HTML
        // parser to only attempt to highlight text nodes to avoid corrupting tags.  
        // If and when this happens, we'll probably have to split his method in two between
        // HTML and plain-text highlighting.

        var safeHighlight = this.html ? sanitizeHtml(highlights[0], sanitizeHtmlParams) : highlights[0];
        while ((offset = safeSnippet.toLowerCase().indexOf(safeHighlight.toLowerCase(), lastOffset)) >= 0) {
            // handle preamble
            if (offset > lastOffset) {
                var subSnippet = safeSnippet.substring(lastOffset, offset);
                nodes = nodes.concat(this._applySubHighlights(subSnippet, highlights));
            }

            // do highlight
            nodes.push(this._createSpan(safeHighlight, true));

            lastOffset = offset + safeHighlight.length;
        }

        // handle postamble
        if (lastOffset != safeSnippet.length) {
            var subSnippet = safeSnippet.substring(lastOffset, undefined);
            nodes = nodes.concat(this._applySubHighlights(subSnippet, highlights));
        }
        return nodes;
    }

    _applySubHighlights(safeSnippet, highlights) {
        if (highlights[1]) {
            // recurse into this range to check for the next set of highlight matches
            return this.applyHighlights(safeSnippet, highlights.slice(1));
        }
        else {
            // no more highlights to be found, just return the unhighlighted string
            return [this._createSpan(safeSnippet, false)];
        }
    }

    /* create a <span> node to hold the given content
     *
     * spanBody: content of the span. If html, must have been sanitised
     * highlight: true to highlight as a search match
     */
    _createSpan(spanBody, highlight) {
        var spanProps = {
            key: this._key++,
        };

        if (highlight) {
            spanProps.onClick = this.onHighlightClick;
            spanProps.className = this.highlightClass;
        }

        if (this.html) {
            return (<span {...spanProps} dangerouslySetInnerHTML={{ __html: spanBody }} />);
        }
        else {
            return (<span {...spanProps}>{ spanBody }</span>);
        }
    }
}


module.exports = {
    /* turn a matrix event body into html
     *
     * content: 'content' of the MatrixEvent
     *
     * highlights: optional list of words to highlight
     *
     * opts.onHighlightClick: optional callback function to be called when a
     *     highlighted word is clicked
     */
    bodyToHtml: function(content, highlights, opts) {
        opts = opts || {};

        var isHtml = (content.format === "org.matrix.custom.html");

        var safeBody;
        if (isHtml) {
            safeBody = sanitizeHtml(content.formatted_body, sanitizeHtmlParams);
        } else {
            safeBody = content.body;
        }

        var body;
        if (highlights && highlights.length > 0) {
            var highlighter = new Highlighter(isHtml, "mx_EventTile_searchHighlight", opts.onHighlightClick);
            body = highlighter.applyHighlights(safeBody, highlights);
        }
        else {
            if (isHtml) {
                body = <span className="markdown-body" dangerouslySetInnerHTML={{ __html: safeBody }} />;
            }
            else {
                body = safeBody;
            }
        }

        return body;
    },

    highlightDom: function(element) {
        var blocks = element.getElementsByTagName("code");
        for (var i = 0; i < blocks.length; i++) {
            highlight.highlightBlock(blocks[i]);
        }
    },

}

