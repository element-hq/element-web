/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import "./@types/commonmark"; // import better types than @types/commonmark
import * as commonmark from "commonmark";
import { escape } from "lodash";
import { logger } from "matrix-js-sdk/src/logger";

import { linkify } from "./linkify-matrix";

const ALLOWED_HTML_TAGS = ["sub", "sup", "del", "s", "u", "br", "br/"];

// These types of node are definitely text
const TEXT_NODES = ["text", "softbreak", "linebreak", "paragraph", "document"];

function isAllowedHtmlTag(node: commonmark.Node): boolean {
    if (!node.literal) {
        return false;
    }

    if (node.literal.match('^<((div|span) data-mx-maths="[^"]*"|/(div|span))>$') != null) {
        return true;
    }

    // Regex won't work for tags with attrs, but the tags we allow
    // shouldn't really have any anyway.
    const matches = /^<\/?(.*)>$/.exec(node.literal);
    if (matches && matches.length == 2) {
        const tag = matches[1];
        return ALLOWED_HTML_TAGS.indexOf(tag) > -1;
    }

    return false;
}

/*
 * Returns true if the parse output containing the node
 * comprises multiple block level elements (ie. lines),
 * or false if it is only a single line.
 */
function isMultiLine(node: commonmark.Node): boolean {
    let par = node;
    while (par.parent) {
        par = par.parent;
    }
    return par.firstChild != par.lastChild;
}

function getTextUntilEndOrLinebreak(node: commonmark.Node): string {
    let currentNode: commonmark.Node | null = node;
    let text = "";
    while (currentNode && currentNode.type !== "softbreak" && currentNode.type !== "linebreak") {
        const { literal, type } = currentNode;
        if (type === "text" && literal) {
            let n = 0;
            let char = literal[n];
            while (char !== " " && char !== null && n <= literal.length) {
                if (char === " ") {
                    break;
                }
                if (char) {
                    text += char;
                }
                n += 1;
                char = literal[n];
            }
            if (char === " ") {
                break;
            }
        }
        currentNode = currentNode.next;
    }
    return text;
}

const formattingChangesByNodeType = {
    emph: "_",
    strong: "__",
};

/**
 * Returns the literal of a node an all child nodes.
 */
const innerNodeLiteral = (node: commonmark.Node): string => {
    let literal = "";

    const walker = node.walker();
    let step: commonmark.NodeWalkingStep | null;

    while ((step = walker.next())) {
        const currentNode = step.node;
        const currentNodeLiteral = currentNode.literal;
        if (step.entering && currentNode.type === "text" && currentNodeLiteral) {
            literal += currentNodeLiteral;
        }
    }

    return literal;
};

const emptyItemWithNoSiblings = (node: commonmark.Node): boolean => {
    return !node.prev && !node.next && !node.firstChild;
};

/**
 * Class that wraps commonmark, adding the ability to see whether
 * a given message actually uses any markdown syntax or whether
 * it's plain text.
 */
export default class Markdown {
    private input: string;
    private parsed: commonmark.Node;

    public constructor(input: string) {
        this.input = input;

        const parser = new commonmark.Parser();
        this.parsed = parser.parse(this.input);
        this.parsed = this.repairLinks(this.parsed);
    }

    /**
     * This method is modifying the parsed AST in such a way that links are always
     * properly linkified instead of sometimes being wrongly emphasised in case
     * if you were to write a link like the example below:
     * https://my_weird-link_domain.domain.com
     * ^ this link would be parsed to something like this:
     * <a href="https://my">https://my</a><b>weird-link</b><a href="https://domain.domain.com">domain.domain.com</a>
     * This method makes it so the link gets properly modified to a version where it is
     * not emphasised until it actually ends.
     * See: https://github.com/vector-im/element-web/issues/4674
     * @param parsed
     */
    private repairLinks(parsed: commonmark.Node): commonmark.Node {
        const walker = parsed.walker();
        let event: commonmark.NodeWalkingStep | null = null;
        let text = "";
        let isInPara = false;
        let previousNode: commonmark.Node | null = null;
        let shouldUnlinkFormattingNode = false;
        while ((event = walker.next())) {
            const { node } = event;
            if (node.type === "paragraph") {
                if (event.entering) {
                    isInPara = true;
                } else {
                    isInPara = false;
                }
            }
            if (isInPara) {
                // Clear saved string when line ends
                if (
                    node.type === "softbreak" ||
                    node.type === "linebreak" ||
                    // Also start calculating the text from the beginning on any spaces
                    (node.type === "text" && node.literal === " ")
                ) {
                    text = "";
                    continue;
                }

                // Break up text nodes on spaces, so that we don't shoot past them without resetting
                if (node.type === "text" && node.literal) {
                    const [thisPart, ...nextParts] = node.literal.split(/( )/);
                    node.literal = thisPart;
                    text += thisPart;

                    // Add the remaining parts as siblings
                    nextParts.reverse().forEach((part) => {
                        if (part) {
                            const nextNode = new commonmark.Node("text");
                            nextNode.literal = part;
                            node.insertAfter(nextNode);
                            // Make the iterator aware of the newly inserted node
                            walker.resumeAt(nextNode, true);
                        }
                    });
                }

                // We should not do this if previous node was not a textnode, as we can't combine it then.
                if ((node.type === "emph" || node.type === "strong") && previousNode?.type === "text") {
                    if (event.entering) {
                        const foundLinks = linkify.find(text);
                        for (const { value } of foundLinks) {
                            if (node?.firstChild?.literal) {
                                /**
                                 * NOTE: This technically should unlink the emph node and create LINK nodes instead, adding all the next elements as siblings
                                 * but this solution seems to work well and is hopefully slightly easier to understand too
                                 */
                                const format = formattingChangesByNodeType[node.type];
                                const nonEmphasizedText = `${format}${innerNodeLiteral(node)}${format}`;
                                const f = getTextUntilEndOrLinebreak(node);
                                const newText = value + nonEmphasizedText + f;
                                const newLinks = linkify.find(newText);
                                // Should always find only one link here, if it finds more it means that the algorithm is broken
                                if (newLinks.length === 1) {
                                    const emphasisTextNode = new commonmark.Node("text");
                                    emphasisTextNode.literal = nonEmphasizedText;
                                    previousNode.insertAfter(emphasisTextNode);
                                    node.firstChild.literal = "";
                                    event = node.walker().next();
                                    if (event) {
                                        // Remove `em` opening and closing nodes
                                        node.unlink();
                                        previousNode.insertAfter(event.node);
                                        shouldUnlinkFormattingNode = true;
                                    }
                                } else {
                                    logger.error(
                                        "Markdown links escaping found too many links for following text: ",
                                        text,
                                    );
                                    logger.error(
                                        "Markdown links escaping found too many links for modified text: ",
                                        newText,
                                    );
                                }
                            }
                        }
                    } else {
                        if (shouldUnlinkFormattingNode) {
                            node.unlink();
                            shouldUnlinkFormattingNode = false;
                        }
                    }
                }
            }
            previousNode = node;
        }
        return parsed;
    }

    public isPlainText(): boolean {
        const walker = this.parsed.walker();
        let ev: commonmark.NodeWalkingStep | null;

        while ((ev = walker.next())) {
            const node = ev.node;

            if (TEXT_NODES.indexOf(node.type) > -1) {
                // definitely text
                continue;
            } else if (node.type == "list" || node.type == "item") {
                // Special handling for inputs like `+`, `*`, `-` and `2021.` which
                // would otherwise be treated as a list of a single empty item.
                // See https://github.com/vector-im/element-web/issues/7631
                if (node.type == "list" && node.firstChild && emptyItemWithNoSiblings(node.firstChild)) {
                    // A list with a single empty item is treated as plain text.
                    continue;
                }

                if (node.type == "item" && emptyItemWithNoSiblings(node)) {
                    // An empty list item with no sibling items is treated as plain text.
                    continue;
                }

                // Everything else is actual lists and therefore not plaintext.
                return false;
            } else if (node.type == "html_inline" || node.type == "html_block") {
                // if it's an allowed html tag, we need to render it and therefore
                // we will need to use HTML. If it's not allowed, it's not HTML since
                // we'll just be treating it as text.
                if (isAllowedHtmlTag(node)) {
                    return false;
                }
            } else {
                return false;
            }
        }
        return true;
    }

    public toHTML({ externalLinks = false } = {}): string {
        const renderer = new commonmark.HtmlRenderer({
            safe: false,

            // Set soft breaks to hard HTML breaks: commonmark
            // puts softbreaks in for multiple lines in a blockquote,
            // so if these are just newline characters then the
            // block quote ends up all on one line
            // (https://github.com/vector-im/element-web/issues/3154)
            softbreak: "<br />",
        });

        // Trying to strip out the wrapping <p/> causes a lot more complication
        // than it's worth, i think.  For instance, this code will go and strip
        // out any <p/> tag (no matter where it is in the tree) which doesn't
        // contain \n's.
        // On the flip side, <p/>s are quite opionated and restricted on where
        // you can nest them.
        //
        // Let's try sending with <p/>s anyway for now, though.
        const realParagraph = renderer.paragraph;
        renderer.paragraph = function (node: commonmark.Node, entering: boolean) {
            // If there is only one top level node, just return the
            // bare text: it's a single line of text and so should be
            // 'inline', rather than unnecessarily wrapped in its own
            // p tag. If, however, we have multiple nodes, each gets
            // its own p tag to keep them as separate paragraphs.
            // However, if it's a blockquote, adds a p tag anyway
            // in order to avoid deviation to commonmark and unexpected
            // results when parsing the formatted HTML.
            if (node.parent?.type === "block_quote" || isMultiLine(node)) {
                realParagraph.call(this, node, entering);
            }
        };

        renderer.link = function (node, entering) {
            const attrs = this.attrs(node);
            if (entering && node.destination) {
                attrs.push(["href", this.esc(node.destination)]);
                if (node.title) {
                    attrs.push(["title", this.esc(node.title)]);
                }
                // Modified link behaviour to treat them all as external and
                // thus opening in a new tab.
                if (externalLinks) {
                    attrs.push(["target", "_blank"]);
                    attrs.push(["rel", "noreferrer noopener"]);
                }
                this.tag("a", attrs);
            } else {
                this.tag("/a");
            }
        };

        renderer.html_inline = function (node: commonmark.Node) {
            if (node.literal) {
                if (isAllowedHtmlTag(node)) {
                    this.lit(node.literal);
                } else {
                    this.lit(escape(node.literal));
                }
            }
        };

        renderer.html_block = function (node: commonmark.Node) {
            /*
            // as with `paragraph`, we only insert line breaks
            // if there are multiple lines in the markdown.
            const isMultiLine = is_multi_line(node);
            if (isMultiLine) this.cr();
            */
            renderer.html_inline(node);
            /*
            if (isMultiLine) this.cr();
            */
        };

        return renderer.render(this.parsed);
    }

    /*
     * Render the markdown message to plain text. That is, essentially
     * just remove any backslashes escaping what would otherwise be
     * markdown syntax
     * (to fix https://github.com/vector-im/element-web/issues/2870).
     *
     * N.B. this does **NOT** render arbitrary MD to plain text - only MD
     * which has no formatting.  Otherwise it emits HTML(!).
     */
    public toPlaintext(): string {
        const renderer = new commonmark.HtmlRenderer({ safe: false });

        renderer.paragraph = function (node: commonmark.Node, entering: boolean) {
            // as with toHTML, only append lines to paragraphs if there are
            // multiple paragraphs
            if (isMultiLine(node)) {
                if (!entering && node.next) {
                    this.lit("\n\n");
                }
            }
        };

        renderer.html_block = function (node: commonmark.Node) {
            if (node.literal) this.lit(node.literal);
            if (isMultiLine(node) && node.next) this.lit("\n\n");
        };

        // We inhibit the default escape function as we escape the entire output string to correctly handle backslashes
        renderer.esc = (input: string) => input;

        return escape(renderer.render(this.parsed));
    }
}
