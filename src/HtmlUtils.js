/*
Copyright 2015 OpenMarket Ltd

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

module.exports = {
    _applyHighlights: function(safeSnippet, highlights, html, k) {
        var lastOffset = 0;
        var offset;
        var nodes = [];

        // XXX: when highlighting HTML, synapse performs the search on the plaintext body,
        // but we're attempting to apply the highlights here to the HTML body.  This is
        // never going to end well - we really should be hooking into the sanitzer HTML
        // parser to only attempt to highlight text nodes to avoid corrupting tags.  
        // If and when this happens, we'll probably have to split his method in two between
        // HTML and plain-text highlighting.

        var safeHighlight = html ? sanitizeHtml(highlights[0], sanitizeHtmlParams) : highlights[0];
        while ((offset = safeSnippet.indexOf(safeHighlight, lastOffset)) >= 0) {
            // handle preamble
            if (offset > lastOffset) {
                if (highlights[1]) {
                    // recurse into the preamble to check for the next highlights
                    var subnodes = this._applyHighlights( safeSnippet.substring(lastOffset, offset), highlights.slice(1), html, k );
                    nodes = nodes.concat(subnodes);
                    k += subnodes.length;
                }
                else {
                    if (html) {
                        nodes.push(<span key={ k++ } dangerouslySetInnerHTML={{ __html: safeSnippet.substring(lastOffset, offset) }} />);
                    }
                    else {
                        nodes.push(<span key={ k++ }>{ safeSnippet.substring(lastOffset, offset) }</span>);
                    }
                }
            }

            // do highlight
            if (html) {
                nodes.push(<span key={ k++ } dangerouslySetInnerHTML={{ __html: safeHighlight }} className="mx_MessageTile_searchHighlight" />);
            }
            else {
                nodes.push(<span key={ k++ } className="mx_MessageTile_searchHighlight">{ safeHighlight }</span>);
            }

            lastOffset = offset + safeHighlight.length;
        }

        // handle postamble
        if (lastOffset != safeSnippet.length) {
            if (highlights[1]) {
                var subnodes = this._applyHighlights( safeSnippet.substring(lastOffset), highlights.slice(1), html, k ) 
                nodes = nodes.concat( subnodes );
                k += subnodes.length;
            }
            else {
                if (html) {
                    nodes.push(<span className="markdown-body" key={ k++ } dangerouslySetInnerHTML={{ __html: safeSnippet.substring(lastOffset) }} />);
                }
                else {
                    nodes.push(<span className="markdown-body" key={ k++ }>{ safeSnippet.substring(lastOffset) }</span>);
                }
            }
        }
        return nodes;
    },

    bodyToHtml: function(content, highlights) {
        var originalBody = content.body;
        var body;
        var k = 0;

        if (highlights && highlights.length > 0) {
            var bodyList = [];

            if (content.format === "org.matrix.custom.html") {
                var safeBody = sanitizeHtml(content.formatted_body, sanitizeHtmlParams);
                bodyList = this._applyHighlights(safeBody, highlights, true, k);
            }
            else {
                bodyList = this._applyHighlights(originalBody, highlights, true, k);
            }
            body = bodyList;
        }
        else {
            if (content.format === "org.matrix.custom.html") {
                var safeBody = sanitizeHtml(content.formatted_body, sanitizeHtmlParams);
                body = <span className="markdown-body" dangerouslySetInnerHTML={{ __html: safeBody }} />;
            }
            else {
                body = originalBody;
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

