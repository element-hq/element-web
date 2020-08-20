/*
Copyright 2019 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import { walkDOMDepthFirst } from "./dom";
import { checkBlockNode } from "../HtmlUtils";
import { getPrimaryPermalinkEntity } from "../utils/permalinks/Permalinks";
import { PartCreator } from "./parts";

function parseAtRoomMentions(text: string, partCreator: PartCreator) {
    const ATROOM = "@room";
    const parts = [];
    text.split(ATROOM).forEach((textPart, i, arr) => {
        if (textPart.length) {
            parts.push(partCreator.plain(textPart));
        }
        // it's safe to never append @room after the last textPart
        // as split will report an empty string at the end if
        // `text` ended in @room.
        const isLast = i === arr.length - 1;
        if (!isLast) {
            parts.push(partCreator.atRoomPill(ATROOM));
        }
    });
    return parts;
}

function parseLink(a: HTMLAnchorElement, partCreator: PartCreator) {
    const {href} = a;
    const resourceId = getPrimaryPermalinkEntity(href); // The room/user ID
    const prefix = resourceId ? resourceId[0] : undefined; // First character of ID
    switch (prefix) {
        case "@":
            return partCreator.userPill(a.textContent, resourceId);
        case "#":
            return partCreator.roomPill(resourceId);
        default: {
            if (href === a.textContent) {
                return partCreator.plain(a.textContent);
            } else {
                return partCreator.plain(`[${a.textContent.replace(/[[\\\]]/g, c => "\\" + c)}](${href})`);
            }
        }
    }
}

function parseCodeBlock(n: HTMLElement, partCreator: PartCreator) {
    const parts = [];
    let language = "";
    if (n.firstChild && n.firstChild.nodeName === "CODE") {
        for (const className of (<HTMLElement>n.firstChild).classList) {
            if (className.startsWith("language-") && !className.startsWith("language-_")) {
                language = className.substr("language-".length);
                break;
            }
        }
    }
    const preLines = ("```" + language + "\n" + n.textContent + "```").split("\n");
    preLines.forEach((l, i) => {
        parts.push(partCreator.plain(l));
        if (i < preLines.length - 1) {
            parts.push(partCreator.newline());
        }
    });
    return parts;
}

function parseHeader(el: HTMLElement, partCreator: PartCreator) {
    const depth = parseInt(el.nodeName.substr(1), 10);
    return partCreator.plain("#".repeat(depth) + " ");
}

interface IState {
    listIndex: number[];
    listDepth?: number;
}

function parseElement(n: HTMLElement, partCreator: PartCreator, lastNode: HTMLElement | undefined, state: IState) {
    switch (n.nodeName) {
        case "H1":
        case "H2":
        case "H3":
        case "H4":
        case "H5":
        case "H6":
            return parseHeader(n, partCreator);
        case "A":
            return parseLink(<HTMLAnchorElement>n, partCreator);
        case "BR":
            return partCreator.newline();
        case "EM":
            return partCreator.plain(`_${n.textContent}_`);
        case "STRONG":
            return partCreator.plain(`**${n.textContent}**`);
        case "PRE":
            return parseCodeBlock(n, partCreator);
        case "CODE":
            return partCreator.plain(`\`${n.textContent}\``);
        case "DEL":
            return partCreator.plain(`<del>${n.textContent}</del>`);
        case "LI": {
            const indent = "  ".repeat(state.listDepth - 1);
            if (n.parentElement.nodeName === "OL") {
                // The markdown parser doesn't do nested indexed lists at all, but this supports it anyway.
                const index = state.listIndex[state.listIndex.length - 1];
                state.listIndex[state.listIndex.length - 1] += 1;
                return partCreator.plain(`${indent}${index}. `);
            } else {
                return partCreator.plain(`${indent}- `);
            }
        }
        case "P": {
            if (lastNode) {
                return partCreator.newline();
            }
            break;
        }
        case "OL":
            state.listIndex.push((<HTMLOListElement>n).start || 1);
            /* falls through */
        case "UL":
            state.listDepth = (state.listDepth || 0) + 1;
            /* falls through */
        default:
            // don't textify block nodes we'll descend into
            if (!checkDescendInto(n)) {
                return partCreator.plain(n.textContent);
            }
    }
}

function checkDescendInto(node) {
    switch (node.nodeName) {
        case "PRE":
            // a code block is textified in parseCodeBlock
            // as we don't want to preserve markup in it,
            // so no need to descend into it
            return false;
        default:
            return checkBlockNode(node);
    }
}

function checkIgnored(n) {
    if (n.nodeType === Node.TEXT_NODE) {
        // Element adds \n text nodes in a lot of places,
        // which should be ignored
        return n.nodeValue === "\n";
    } else if (n.nodeType === Node.ELEMENT_NODE) {
        return n.nodeName === "MX-REPLY";
    }
    return true;
}

const QUOTE_LINE_PREFIX = "> ";
function prefixQuoteLines(isFirstNode, parts, partCreator) {
    // a newline (to append a > to) wouldn't be added to parts for the first line
    // if there was no content before the BLOCKQUOTE, so handle that
    if (isFirstNode) {
        parts.splice(0, 0, partCreator.plain(QUOTE_LINE_PREFIX));
    }
    for (let i = 0; i < parts.length; i += 1) {
        if (parts[i].type === "newline") {
            parts.splice(i + 1, 0, partCreator.plain(QUOTE_LINE_PREFIX));
            i += 1;
        }
    }
}

function parseHtmlMessage(html: string, partCreator: PartCreator, isQuotedMessage: boolean) {
    // no nodes from parsing here should be inserted in the document,
    // as scripts in event handlers, etc would be executed then.
    // we're only taking text, so that is fine
    const rootNode = new DOMParser().parseFromString(html, "text/html").body;
    const parts = [];
    let lastNode;
    let inQuote = isQuotedMessage;
    const state: IState = {
        listIndex: [],
    };

    function onNodeEnter(n) {
        if (checkIgnored(n)) {
            return false;
        }
        if (n.nodeName === "BLOCKQUOTE") {
            inQuote = true;
        }

        const newParts = [];
        if (lastNode && (checkBlockNode(lastNode) || checkBlockNode(n))) {
            newParts.push(partCreator.newline());
        }

        if (n.nodeType === Node.TEXT_NODE) {
            newParts.push(...parseAtRoomMentions(n.nodeValue, partCreator));
        } else if (n.nodeType === Node.ELEMENT_NODE) {
            const parseResult = parseElement(n, partCreator, lastNode, state);
            if (parseResult) {
                if (Array.isArray(parseResult)) {
                    newParts.push(...parseResult);
                } else {
                    newParts.push(parseResult);
                }
            }
        }

        if (newParts.length && inQuote) {
            const isFirstPart = parts.length === 0;
            prefixQuoteLines(isFirstPart, newParts, partCreator);
        }

        parts.push(...newParts);

        const descend = checkDescendInto(n);
        // when not descending (like for PRE), onNodeLeave won't be called to set lastNode
        // so do that here.
        lastNode = descend ? null : n;
        return descend;
    }

    function onNodeLeave(n) {
        if (checkIgnored(n)) {
            return;
        }
        switch (n.nodeName) {
            case "BLOCKQUOTE":
                inQuote = false;
                break;
            case "OL":
                state.listIndex.pop();
                /* falls through */
            case "UL":
                state.listDepth -= 1;
                break;
        }
        lastNode = n;
    }

    walkDOMDepthFirst(rootNode, onNodeEnter, onNodeLeave);

    return parts;
}

export function parsePlainTextMessage(body: string, partCreator: PartCreator, isQuotedMessage?: boolean) {
    const lines = body.split(/\r\n|\r|\n/g); // split on any new-line combination not just \n, collapses \r\n
    return lines.reduce((parts, line, i) => {
        if (isQuotedMessage) {
            parts.push(partCreator.plain(QUOTE_LINE_PREFIX));
        }
        parts.push(...parseAtRoomMentions(line, partCreator));
        const isLast = i === lines.length - 1;
        if (!isLast) {
            parts.push(partCreator.newline());
        }
        return parts;
    }, []);
}

export function parseEvent(event: MatrixEvent, partCreator: PartCreator, {isQuotedMessage = false} = {}) {
    const content = event.getContent();
    let parts;
    if (content.format === "org.matrix.custom.html") {
        parts = parseHtmlMessage(content.formatted_body || "", partCreator, isQuotedMessage);
    } else {
        parts = parsePlainTextMessage(content.body || "", partCreator, isQuotedMessage);
    }
    if (content.msgtype === "m.emote") {
        parts.unshift(partCreator.plain("/me "));
    }
    return parts;
}
