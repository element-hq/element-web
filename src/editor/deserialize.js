/*
Copyright 2019 New Vector Ltd

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

function parseHtmlMessage(html, room) {
    const REGEX_MATRIXTO = new RegExp(MATRIXTO_URL_PATTERN);
    // no nodes from parsing here should be inserted in the document,
    // as scripts in event handlers, etc would be executed then.
    // we're only taking text, so that is fine
    const nodes = Array.from(new DOMParser().parseFromString(html, "text/html").body.childNodes);
    const parts = nodes.map(n => {
        switch (n.nodeType) {
            case Node.TEXT_NODE:
                return new PlainPart(n.nodeValue);
            case Node.ELEMENT_NODE:
                switch (n.nodeName) {
                    case "MX-REPLY":
                        return null;
                    case "A": {
                        const {href} = n;
                        const pillMatch = REGEX_MATRIXTO.exec(href) || [];
                        const resourceId = pillMatch[1]; // The room/user ID
                        const prefix = pillMatch[2]; // The first character of prefix
                        switch (prefix) {
                            case "@": return new UserPillPart(resourceId, n.textContent, room.getMember(resourceId));
                            case "#": return new RoomPillPart(resourceId);
                            default: return new PlainPart(n.textContent);
                        }
                    }
                    case "BR":
                        return new NewlinePart("\n");
                    default:
                        return new PlainPart(n.textContent);
                }
            default:
                return null;
        }
    }).filter(p => !!p);
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
