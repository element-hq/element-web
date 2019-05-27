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

const REGEX_MATRIXTO = new RegExp(MATRIXTO_URL_PATTERN);

function parseLink(a, parts, room) {
    const {href} = a;
    const pillMatch = REGEX_MATRIXTO.exec(href) || [];
    const resourceId = pillMatch[1]; // The room/user ID
    const prefix = pillMatch[2]; // The first character of prefix
    switch (prefix) {
        case "@":
            parts.push(new UserPillPart(
                resourceId,
                a.textContent,
                room.getMember(resourceId),
            ));
            break;
        case "#":
            parts.push(new RoomPillPart(resourceId));
            break;
        default: {
            if (href === a.textContent) {
                    parts.push(new PlainPart(a.textContent));
            } else {
                    parts.push(new PlainPart(`[${a.textContent}](${href})`));
            }
            break;
        }
    }
}

function parseHtmlMessage(html, room) {
    // no nodes from parsing here should be inserted in the document,
    // as scripts in event handlers, etc would be executed then.
    // we're only taking text, so that is fine
    const root = new DOMParser().parseFromString(html, "text/html").body;
    let n = root.firstChild;
    const parts = [];
    let isFirstNode = true;
    while (n && n !== root) {
        switch (n.nodeType) {
            case Node.TEXT_NODE:
                // the plainpart doesn't accept \n and will cause
                // a newlinepart to be created.
                if (n.nodeValue !== "\n") {
                    parts.push(new PlainPart(n.nodeValue));
                }
                break;
            case Node.ELEMENT_NODE:
                switch (n.nodeName) {
                    case "MX-REPLY":
                        break;
                    case "DIV":
                    case "P": {
                        // block element should cause line break if not first
                        if (!isFirstNode) {
                            parts.push(new NewlinePart("\n"));
                        }
                        // decend into paragraph or div
                        if (n.firstChild) {
                            n = n.firstChild;
                            continue;
                        } else {
                            break;
                        }
                    }
                    case "A": {
                        parseLink(n, parts, room);
                        break;
                    }
                    case "BR":
                        parts.push(new NewlinePart("\n"));
                        break;
                    case "EM":
                        parts.push(new PlainPart(`*${n.textContent}*`));
                        break;
                    case "STRONG":
                        parts.push(new PlainPart(`**${n.textContent}**`));
                        break;
                    case "PRE": {
                        // block element should cause line break if not first
                        if (!isFirstNode) {
                            parts.push(new NewlinePart("\n"));
                        }
                        const preLines = `\`\`\`\n${n.textContent}\`\`\``.split("\n");
                        preLines.forEach((l, i) => {
                            parts.push(new PlainPart(l));
                            if (i < preLines.length - 1) {
                                parts.push(new NewlinePart("\n"));
                            }
                        });
                        break;
                    }
                    case "CODE":
                        parts.push(new PlainPart(`\`${n.textContent}\``));
                        break;
                    case "DEL":
                        parts.push(new PlainPart(`<del>${n.textContent}</del>`));
                        break;
                    default:
                        parts.push(new PlainPart(n.textContent));
                        break;
                }
                break;
        }
        // go up if we can't go next
        if (!n.nextSibling) {
            n = n.parentElement;
        }
        n = n.nextSibling;
        isFirstNode = false;
    }
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
