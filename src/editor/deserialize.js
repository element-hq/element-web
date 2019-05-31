/*
Copyright 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import { MATRIXTO_URL_PATTERN } from '../linkify-matrix';
import { PlainPart, UserPillPart, RoomPillPart, NewlinePart } from "./parts";
import { walkDOMDepthFirst } from "./dom";

const REGEX_MATRIXTO = new RegExp(MATRIXTO_URL_PATTERN);

function parseLink(a, room) {
    const {href} = a;
    const pillMatch = REGEX_MATRIXTO.exec(href) || [];
    const resourceId = pillMatch[1]; // The room/user ID
    const prefix = pillMatch[2]; // The first character of prefix
    switch (prefix) {
        case "@":
            return new UserPillPart(
                resourceId,
                a.textContent,
                room.getMember(resourceId),
            );
        case "#":
            return new RoomPillPart(resourceId);
        default: {
            if (href === a.textContent) {
                return new PlainPart(a.textContent);
            } else {
                return new PlainPart(`[${a.textContent}](${href})`);
            }
        }
    }
}

function parseCodeBlock(n) {
    const parts = [];
    const preLines = ("```\n" + n.textContent + "```").split("\n");
    preLines.forEach((l, i) => {
        parts.push(new PlainPart(l));
        if (i < preLines.length - 1) {
            parts.push(new NewlinePart("\n"));
        }
    });
    return parts;
}

function parseElement(n, room) {
    switch (n.nodeName) {
        case "A":
            return parseLink(n, room);
        case "BR":
            return new NewlinePart("\n");
        case "EM":
            return new PlainPart(`*${n.textContent}*`);
        case "STRONG":
            return new PlainPart(`**${n.textContent}**`);
        case "PRE":
            return parseCodeBlock(n);
        case "CODE":
            return new PlainPart(`\`${n.textContent}\``);
        case "DEL":
            return new PlainPart(`<del>${n.textContent}</del>`);
        case "LI":
            if (n.parentElement.nodeName === "OL") {
                return new PlainPart(` 1. `);
            } else {
                return new PlainPart(` - `);
            }
        default:
            // don't textify block nodes we'll decend into
            if (!checkDecendInto(n)) {
                return new PlainPart(n.textContent);
            }
    }
}

function checkDecendInto(node) {
    switch (node.nodeName) {
        case "PRE":
            // a code block is textified in parseCodeBlock
            // as we don't want to preserve markup in it,
            // so no need to decend into it
            return false;
        default:
            return checkBlockNode(node);
    }
}

function checkBlockNode(node) {
    switch (node.nodeName) {
        case "PRE":
        case "BLOCKQUOTE":
        case "DIV":
        case "P":
        case "UL":
        case "OL":
        case "LI":
            return true;
        default:
            return false;
    }
}

function checkIgnored(n) {
    if (n.nodeType === Node.TEXT_NODE) {
        // riot adds \n text nodes in a lot of places,
        // which should be ignored
        return n.nodeValue === "\n";
    } else if (n.nodeType === Node.ELEMENT_NODE) {
        return n.nodeName === "MX-REPLY";
    }
    return true;
}

function prefixQuoteLines(isFirstNode, parts) {
    const PREFIX = "> ";
    // a newline (to append a > to) wouldn't be added to parts for the first line
    // if there was no content before the BLOCKQUOTE, so handle that
    if (isFirstNode) {
        parts.splice(0, 0, new PlainPart(PREFIX));
    }
    for (let i = 0; i < parts.length; i += 1) {
        if (parts[i].type === "newline") {
            parts.splice(i + 1, 0, new PlainPart(PREFIX));
            i += 1;
        }
    }
}

function parseHtmlMessage(html, room) {
    // no nodes from parsing here should be inserted in the document,
    // as scripts in event handlers, etc would be executed then.
    // we're only taking text, so that is fine
    const rootNode = new DOMParser().parseFromString(html, "text/html").body;
    const parts = [];
    let lastNode;
    let inQuote = false;

    function onNodeEnter(n) {
        if (checkIgnored(n)) {
            return false;
        }
        if (n.nodeName === "BLOCKQUOTE") {
            inQuote = true;
        }

        const newParts = [];
        if (lastNode && (checkBlockNode(lastNode) || checkBlockNode(n))) {
            newParts.push(new NewlinePart("\n"));
        }

        if (n.nodeType === Node.TEXT_NODE) {
            newParts.push(new PlainPart(n.nodeValue));
        } else if (n.nodeType === Node.ELEMENT_NODE) {
            const parseResult = parseElement(n, room);
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
            prefixQuoteLines(isFirstPart, newParts);
        }

        parts.push(...newParts);

        // extra newline after quote, only if there something behind it...
        if (lastNode && lastNode.nodeName === "BLOCKQUOTE") {
            parts.push(new NewlinePart("\n"));
        }
        lastNode = null;
        return checkDecendInto(n);
    }

    function onNodeLeave(n) {
        if (checkIgnored(n)) {
            return;
        }
        if (n.nodeName === "BLOCKQUOTE") {
            inQuote = false;
        }
        lastNode = n;
    }

    walkDOMDepthFirst(rootNode, onNodeEnter, onNodeLeave);

    return parts;
}

export function parseEvent(event, room) {
    const content = event.getContent();
    if (content.format === "org.matrix.custom.html") {
        return parseHtmlMessage(content.formatted_body || "", room);
    } else {
        const body = content.body || "";
        const lines = body.split("\n");
        const parts = lines.reduce((parts, line, i) => {
            const isLast = i === lines.length - 1;
            const text = new PlainPart(line);
            const newLine = !isLast && new NewlinePart("\n");
            if (newLine) {
                return parts.concat(text, newLine);
            } else {
                return parts.concat(text);
            }
        }, []);
        return parts;
    }
}
