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
        // we determine if the message requires markdown by
        // running the parser on the tokens with a dummy
        // rendered and seeing if any of the renderer's
        // functions are called other than those noted below.
        // TODO: can't we just examine the output of the parser?
        let is_plain = true;

        function setNotPlain() {
            is_plain = false;
        }

        const dummy_renderer = new commonmark.HtmlRenderer();
        for (const k of Object.keys(commonmark.HtmlRenderer.prototype)) {
            dummy_renderer[k] = setNotPlain;
        }
        // text and paragraph are just text
        dummy_renderer.text = function(t) { return t; };
        dummy_renderer.softbreak = function(t) { return t; };
        dummy_renderer.paragraph = function(t) { return t; };

        dummy_renderer.render(this.parsed);

        return is_plain;
    }

    toHTML() {
        const renderer = new commonmark.HtmlRenderer({safe: false});
        const real_paragraph = renderer.paragraph;

        renderer.paragraph = function(node, entering) {
            // If there is only one top level node, just return the
            // bare text: it's a single line of text and so should be
            // 'inline', rather than unnecessarily wrapped in its own
            // p tag. If, however, we have multiple nodes, each gets
            // its own p tag to keep them as separate paragraphs.
            var par = node;
            while (par.parent) {
                par = par.parent;
            }
            if (par.firstChild != par.lastChild) {
                real_paragraph.call(this, node, entering);
            }
        };

        return renderer.render(this.parsed);
    }

    /*
     * Render the mrkdown message to plain text. That is, essentially
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
            // If there is only one top level node, just return the
            // bare text: it's a single line of text and so should be
            // 'inline', rather than unnecessarily wrapped in its own
            // p tag. If, however, we have multiple nodes, each gets
            // its own p tag to keep them as separate paragraphs.
            var par = node;
            while (par.parent) {
                node = par;
                par = par.parent;
            }
            if (node != par.lastChild) {
                if (!entering) {
                    this.lit('\n\n');
                }
            }
        };

        return renderer.render(this.parsed);
    }
}
