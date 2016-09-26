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

import marked from 'marked';

// marked only applies the default options on the high
// level marked() interface, so we do it here.
const marked_options = Object.assign({}, marked.defaults, {
    gfm: true,
    tables: true,
    breaks: true,
    pedantic: false,
    sanitize: true,
    smartLists: true,
    smartypants: false,
    xhtml: true, // return self closing tags (ie. <br /> not <br>)
});

/**
 * Class that wraps marked, adding the ability to see whether
 * a given message actually uses any markdown syntax or whether
 * it's plain text.
 */
export default class Markdown {
    constructor(input) {
        const lexer = new marked.Lexer(marked_options);
        this.tokens = lexer.lex(input);
    }

    _copyTokens() {
        // copy tokens (the parser modifies its input arg)
        const tokens_copy = this.tokens.slice();
        // it also has a 'links' property, because this is javascript
        // and why wouldn't you have an array that also has properties?
        return Object.assign(tokens_copy, this.tokens);
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

        const dummy_renderer = {};
        for (const k of Object.keys(marked.Renderer.prototype)) {
            dummy_renderer[k] = setNotPlain;
        }
        // text and paragraph are just text
        dummy_renderer.text = function(t){return t;}
        dummy_renderer.paragraph = function(t){return t;}

        // ignore links where text is just the url:
        // this ignores plain URLs that markdown has
        // detected whilst preserving markdown syntax links
        dummy_renderer.link = function(href, title, text) {
            if (text != href) {
                is_plain = false;
            }
        }

        const dummy_options = Object.assign({}, marked_options, {
            renderer: dummy_renderer,
        });
        const dummy_parser = new marked.Parser(dummy_options);
        dummy_parser.parse(this._copyTokens());

        return is_plain;
    }

    toHTML() {
        const real_renderer = new marked.Renderer();
        real_renderer.link = function(href, title, text) {
            // prevent marked from turning plain URLs
            // into links, because its algorithm is fairly
            // poor. Let's send plain URLs rather than
            // badly linkified ones (the linkifier Vector
            // uses on message display is way better, eg.
            // handles URLs with closing parens at the end).
            if (text == href) {
                return href;
            }
            return marked.Renderer.prototype.link.apply(this, arguments);
        }

        real_renderer.paragraph = (text) => {
            // The tokens at the top level are the 'blocks', so if we
            // have more than one, there are multiple 'paragraphs'.
            // If there is only one top level token, just return the
            // bare text: it's a single line of text and so should be
            // 'inline', rather than necessarily wrapped in its own
            // p tag. If, however, we have multiple tokens, each gets
            // its own p tag to keep them as separate paragraphs.
            if (this.tokens.length == 1) {
                return text;
            }
            return '<p>' + text + '</p>';
        }

        const real_options = Object.assign({}, marked_options, {
            renderer: real_renderer,
        });
        const real_parser = new marked.Parser(real_options);
        return real_parser.parse(this._copyTokens());
    }
}
