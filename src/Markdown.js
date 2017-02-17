/*
Copyright 2016 OpenMarket Ltd

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

import commonmark from 'commonmark';
import escape from 'lodash/escape';

const ALLOWED_HTML_TAGS = ['del'];

// These types of node are definitely text
const TEXT_NODES = ['text', 'softbreak', 'linebreak', 'paragraph', 'document'];

function is_allowed_html_tag(node) {
    // Regex won't work for tags with attrs, but we only
    // allow <del> anyway.
    const matches = /^<\/?(.*)>$/.exec(node.literal);
    if (matches && matches.length == 2) {
        const tag = matches[1];
        return ALLOWED_HTML_TAGS.indexOf(tag) > -1;
    }
    return false;
}

function html_if_tag_allowed(node) {
    if (is_allowed_html_tag(node)) {
        this.lit(node.literal);
        return;
    } else {
        this.lit(escape(node.literal));
    }
}

/*
 * Returns true if the parse output containing the node
 * comprises multiple block level elements (ie. lines),
 * or false if it is only a single line.
 */
function is_multi_line(node) {
    var par = node;
    while (par.parent) {
        par = par.parent;
    }
    return par.firstChild != par.lastChild;
}

/**
 * Class that wraps commonmark, adding the ability to see whether
 * a given message actually uses any markdown syntax or whether
 * it's plain text.
 */
export default class Markdown {
    constructor(input) {
        this.input = input;

        const parser = new commonmark.Parser();
        this.parsed = parser.parse(this.input);
    }

    isPlainText() {
        const walker = this.parsed.walker();

        let ev;
        while ( (ev = walker.next()) ) {
            const node = ev.node;
            if (TEXT_NODES.indexOf(node.type) > -1) {
                // definitely text
                continue;
            } else if (node.type == 'html_inline' || node.type == 'html_block') {
                // if it's an allowed html tag, we need to render it and therefore
                // we will need to use HTML. If it's not allowed, it's not HTML since
                // we'll just be treating it as text.
                if (is_allowed_html_tag(node)) {
                    return false;
                }
            } else {
                return false;
            }
        }
        return true;
    }

    toHTML() {
        const renderer = new commonmark.HtmlRenderer({
            safe: false,

            // Set soft breaks to hard HTML breaks: commonmark
            // puts softbreaks in for multiple lines in a blockquote,
            // so if these are just newline characters then the
            // block quote ends up all on one line
            // (https://github.com/vector-im/riot-web/issues/3154)
            softbreak: '<br />',
        });
        const real_paragraph = renderer.paragraph;

        renderer.paragraph = function(node, entering) {
            // If there is only one top level node, just return the
            // bare text: it's a single line of text and so should be
            // 'inline', rather than unnecessarily wrapped in its own
            // p tag. If, however, we have multiple nodes, each gets
            // its own p tag to keep them as separate paragraphs.
            if (is_multi_line(node)) {
                real_paragraph.call(this, node, entering);
            }
        };

        renderer.html_inline = html_if_tag_allowed;
        renderer.html_block = function(node) {
            // as with `paragraph`, we only insert line breaks
            // if there are multiple lines in the markdown.
            const isMultiLine = is_multi_line(node);

            if (isMultiLine) this.cr();
            html_if_tag_allowed.call(this, node);
            if (isMultiLine) this.cr();
        }

        return renderer.render(this.parsed);
    }

    /*
     * Render the markdown message to plain text. That is, essentially
     * just remove any backslashes escaping what would otherwise be
     * markdown syntax
     * (to fix https://github.com/vector-im/riot-web/issues/2870)
     */
    toPlaintext() {
        const renderer = new commonmark.HtmlRenderer({safe: false});
        const real_paragraph = renderer.paragraph;

        // The default `out` function only sends the input through an XML
        // escaping function, which causes messages to be entity encoded,
        // which we don't want in this case.
        renderer.out = function(s) {
            // The `lit` function adds a string literal to the output buffer.
            this.lit(s);
        };

        renderer.paragraph = function(node, entering) {
            // as with toHTML, only append lines to paragraphs if there are
            // multiple paragraphs
            if (is_multi_line(node)) {
                if (!entering && node.next) {
                    this.lit('\n\n');
                }
            }
        };
        renderer.html_block = function(node) {
            this.lit(node.literal);
            if (is_multi_line(node) && node.next) this.lit('\n\n');
        }

        return renderer.render(this.parsed);
    }
}
