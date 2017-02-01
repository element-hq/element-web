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
 * Class that wraps marked, adding the ability to see whether
 * a given message actually uses any markdown syntax or whether
 * it's plain text.
 */
export default class Markdown {
    constructor(input) {
        this.input = input;
        this.parser = new commonmark.Parser();
        this.renderer = new commonmark.HtmlRenderer({safe: false});
    }

    isPlainText() {
        // we determine if the message requires markdown by
        // running the parser on the tokens with a dummy
        // rendered and seeing if any of the renderer's
        // functions are called other than those noted below.
        // In case you were wondering, no we can't just examine
        // the tokens because the tokens we have are only the
        // output of the *first* tokenizer: any line-based
        // markdown is processed by marked within Parser by
        // the 'inline lexer'...
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

        const dummy_parser = new commonmark.Parser();
        dummy_renderer.render(dummy_parser.parse(this.input));

        return is_plain;
    }

    toHTML() {
        const real_paragraph = this.renderer.paragraph;

        this.renderer.paragraph = function(node, entering) {
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

        var parsed = this.parser.parse(this.input);
        var rendered = this.renderer.render(parsed);

        this.renderer.paragraph = real_paragraph;

        return rendered;
    }

    toPlaintext() {
        const real_paragraph = this.renderer.paragraph;

        // The default `out` function only sends the input through an XML
        // escaping function, which causes messages to be entity encoded,
        // which we don't want in this case.
        this.renderer.out = function(s) {
            // The `lit` function adds a string literal to the output buffer.
            this.lit(s);
        };

        this.renderer.paragraph = function(node, entering) {
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

        var parsed = this.parser.parse(this.input);
        var rendered = this.renderer.render(parsed);

        this.renderer.paragraph = real_paragraph;

        return rendered;
    }
}
