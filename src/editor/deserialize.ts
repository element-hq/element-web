/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { checkBlockNode } from "../HtmlUtils";
import { getPrimaryPermalinkEntity } from "../utils/permalinks/Permalinks";
import { type Part, type PartCreator, Type } from "./parts";
import SdkConfig from "../SdkConfig";
import { textToHtmlRainbow } from "../utils/colour";
import { stripPlainReply } from "../utils/Reply";

const LIST_TYPES = ["UL", "OL", "LI"];

// Escapes all markup in the given text
function escape(text: string): string {
    return text.replace(/[\\*_[\]`<]|^>/g, (match) => `\\${match}`);
}

// Finds the length of the longest backtick sequence in the given text, used for
// escaping backticks in code blocks
export function longestBacktickSequence(text: string): number {
    let length = 0;
    let currentLength = 0;

    for (const c of text) {
        if (c === "`") {
            currentLength++;
        } else {
            length = Math.max(length, currentLength);
            currentLength = 0;
        }
    }

    return Math.max(length, currentLength);
}

function isListChild(n: Node): boolean {
    return LIST_TYPES.includes(n.parentNode?.nodeName || "");
}

function parseAtRoomMentions(text: string, pc: PartCreator, opts: IParseOptions): Part[] {
    const ATROOM = "@room";
    const parts: Part[] = [];
    text.split(ATROOM).forEach((textPart, i, arr) => {
        if (textPart.length) {
            parts.push(...pc.plainWithEmoji(opts.shouldEscape ? escape(textPart) : textPart));
        }
        // it's safe to never append @room after the last textPart
        // as split will report an empty string at the end if
        // `text` ended in @room.
        const isLast = i === arr.length - 1;
        if (!isLast) {
            parts.push(pc.atRoomPill(ATROOM));
        }
    });
    return parts;
}

function parseLink(n: Node, pc: PartCreator, opts: IParseOptions): Part[] {
    const { href } = n as HTMLAnchorElement;
    const resourceId = getPrimaryPermalinkEntity(href); // The room/user ID

    switch (resourceId?.[0]) {
        case "@":
            return [pc.userPill(n.textContent || "", resourceId)];
        case "#":
            return [pc.roomPill(resourceId)];
    }

    const children = Array.from(n.childNodes);
    if (href === n.textContent && children.every((c) => c.nodeType === Node.TEXT_NODE)) {
        return parseAtRoomMentions(n.textContent, pc, opts);
    } else {
        return [pc.plain("["), ...parseChildren(n, pc, opts), pc.plain(`](${href})`)];
    }
}

function parseImage(n: Node, pc: PartCreator, opts: IParseOptions): Part[] {
    const { alt, src } = n as HTMLImageElement;
    return pc.plainWithEmoji(`![${escape(alt)}](${src})`);
}

function parseCodeBlock(n: Node, pc: PartCreator, opts: IParseOptions): Part[] {
    if (!n.textContent) return [];

    let language = "";
    if (n.firstChild?.nodeName === "CODE") {
        for (const className of (n.firstChild as HTMLElement).classList) {
            if (className.startsWith("language-") && !className.startsWith("language-_")) {
                language = className.slice("language-".length);
                break;
            }
        }
    }

    const text = n.textContent.replace(/\n$/, "");
    // Escape backticks by using even more backticks for the fence if necessary
    const fence = "`".repeat(Math.max(3, longestBacktickSequence(text) + 1));
    const parts: Part[] = [...pc.plainWithEmoji(fence + language), pc.newline()];

    text.split("\n").forEach((line) => {
        parts.push(...pc.plainWithEmoji(line));
        parts.push(pc.newline());
    });

    parts.push(pc.plain(fence));
    return parts;
}

function parseHeader(n: Node, pc: PartCreator, opts: IParseOptions): Part[] {
    const depth = parseInt(n.nodeName.slice(1), 10);
    const prefix = pc.plain("#".repeat(depth) + " ");
    return [prefix, ...parseChildren(n, pc, opts)];
}

function checkIgnored(n: Node): boolean {
    if (n.nodeType === Node.TEXT_NODE) {
        // Element adds \n text nodes in a lot of places,
        // which should be ignored
        return n.nodeValue === "\n";
    } else if (n.nodeType === Node.ELEMENT_NODE) {
        return n.nodeName === "MX-REPLY";
    }
    return true;
}

function prefixLines(parts: Part[], prefix: string, pc: PartCreator): void {
    parts.unshift(pc.plain(prefix));
    for (let i = 0; i < parts.length; i++) {
        if (parts[i].type === Type.Newline) {
            parts.splice(i + 1, 0, pc.plain(prefix));
            i += 1;
        }
    }
}

function parseChildren(n: Node, pc: PartCreator, opts: IParseOptions, mkListItem?: (li: Node) => Part[]): Part[] {
    let prev: ChildNode | undefined;
    return Array.from(n.childNodes).flatMap((c) => {
        const parsed = parseNode(c, pc, opts, mkListItem);
        if (parsed.length && prev && (checkBlockNode(prev) || checkBlockNode(c))) {
            if (isListChild(c)) {
                // Use tighter spacing within lists
                parsed.unshift(pc.newline());
            } else {
                parsed.unshift(pc.newline(), pc.newline());
            }
        }
        if (parsed.length) prev = c;
        return parsed;
    });
}

function parseNode(n: Node, pc: PartCreator, opts: IParseOptions, mkListItem?: (li: Node) => Part[]): Part[] {
    if (checkIgnored(n)) return [];

    switch (n.nodeType) {
        case Node.TEXT_NODE:
            return parseAtRoomMentions(n.nodeValue || "", pc, opts);
        case Node.ELEMENT_NODE:
            switch (n.nodeName) {
                case "H1":
                case "H2":
                case "H3":
                case "H4":
                case "H5":
                case "H6":
                    return parseHeader(n, pc, opts);
                case "A":
                    return parseLink(n, pc, opts);
                case "IMG":
                    return parseImage(n, pc, opts);
                case "BR":
                    return [pc.newline()];
                case "HR":
                    return [pc.plain("---")];
                case "EM":
                    return [pc.plain("_"), ...parseChildren(n, pc, opts), pc.plain("_")];
                case "STRONG":
                    return [pc.plain("**"), ...parseChildren(n, pc, opts), pc.plain("**")];
                case "DEL":
                    return [pc.plain("<del>"), ...parseChildren(n, pc, opts), pc.plain("</del>")];
                case "S":
                    return [pc.plain("<s>"), ...parseChildren(n, pc, opts), pc.plain("</s>")];
                case "SUB":
                    return [pc.plain("<sub>"), ...parseChildren(n, pc, opts), pc.plain("</sub>")];
                case "SUP":
                    return [pc.plain("<sup>"), ...parseChildren(n, pc, opts), pc.plain("</sup>")];
                case "U":
                    return [pc.plain("<u>"), ...parseChildren(n, pc, opts), pc.plain("</u>")];
                case "PRE":
                    return parseCodeBlock(n, pc, opts);
                case "CODE": {
                    // Escape backticks by using multiple backticks for the fence if necessary
                    const fence = "`".repeat(longestBacktickSequence(n.textContent || "") + 1);
                    return pc.plainWithEmoji(`${fence}${n.textContent}${fence}`);
                }
                case "BLOCKQUOTE": {
                    const parts = parseChildren(n, pc, opts);
                    prefixLines(parts, "> ", pc);
                    return parts;
                }
                case "LI":
                    return mkListItem?.(n) ?? parseChildren(n, pc, opts);
                case "UL": {
                    const parts = parseChildren(n, pc, opts, (li) => [pc.plain("- "), ...parseChildren(li, pc, opts)]);
                    if (isListChild(n)) {
                        prefixLines(parts, "    ", pc);
                    }
                    return parts;
                }
                case "OL": {
                    let counter = (n as HTMLOListElement).start ?? 1;
                    const parts = parseChildren(n, pc, opts, (li) => {
                        const parts = [pc.plain(`${counter}. `), ...parseChildren(li, pc, opts)];
                        counter++;
                        return parts;
                    });
                    if (isListChild(n)) {
                        prefixLines(parts, "    ", pc);
                    }
                    return parts;
                }
                case "DIV":
                case "SPAN":
                    // Math nodes are translated back into delimited latex strings
                    if ((n as Element).hasAttribute("data-mx-maths")) {
                        const delims = SdkConfig.get().latex_maths_delims;
                        const delimLeft =
                            n.nodeName === "SPAN" ? (delims?.inline?.left ?? "\\(") : (delims?.display?.left ?? "\\[");
                        const delimRight =
                            n.nodeName === "SPAN"
                                ? (delims?.inline?.right ?? "\\)")
                                : (delims?.display?.right ?? "\\]");
                        const tex = (n as Element).getAttribute("data-mx-maths");

                        return pc.plainWithEmoji(`${delimLeft}${tex}${delimRight}`);
                    }
                    // Spoilers are translated back into their slash command form
                    else if ((n as Element).hasAttribute("data-mx-spoiler")) {
                        return [pc.plain("/spoiler "), ...parseChildren(n, pc, opts)];
                    }
            }
    }

    return parseChildren(n, pc, opts);
}

interface IParseOptions {
    isQuotedMessage?: boolean;
    shouldEscape?: boolean;
}

function parseHtmlMessage(html: string, pc: PartCreator, opts: IParseOptions): Part[] {
    // no nodes from parsing here should be inserted in the document,
    // as scripts in event handlers, etc would be executed then.
    // we're only taking text, so that is fine
    const parts = parseNode(new DOMParser().parseFromString(html, "text/html").body, pc, opts);
    if (opts.isQuotedMessage) {
        prefixLines(parts, "> ", pc);
    }
    return parts;
}

export function parsePlainTextMessage(body: string, pc: PartCreator, opts: IParseOptions): Part[] {
    const lines = body.split(/\r\n|\r|\n/g); // split on any new-line combination not just \n, collapses \r\n
    return lines.reduce((parts, line, i) => {
        if (opts.isQuotedMessage) {
            parts.push(pc.plain("> "));
        }
        parts.push(...parseAtRoomMentions(line, pc, opts));
        const isLast = i === lines.length - 1;
        if (!isLast) {
            parts.push(pc.newline());
        }
        return parts;
    }, [] as Part[]);
}

export function parseEvent(event: MatrixEvent, pc: PartCreator, opts: IParseOptions = { shouldEscape: true }): Part[] {
    const content = event.getContent();
    let parts: Part[];
    const isEmote = content.msgtype === MsgType.Emote;
    let isRainbow = false;

    if (content.format === "org.matrix.custom.html") {
        parts = parseHtmlMessage(content.formatted_body || "", pc, opts);
        if (content.body && content.formatted_body && textToHtmlRainbow(content.body) === content.formatted_body) {
            isRainbow = true;
        }
    } else {
        let body = content.body || "";
        if (event.replyEventId) {
            body = stripPlainReply(body);
        }
        parts = parsePlainTextMessage(body, pc, opts);
    }

    if (isEmote && isRainbow) {
        parts.unshift(pc.plain("/rainbowme "));
    } else if (isRainbow) {
        parts.unshift(pc.plain("/rainbow "));
    } else if (isEmote) {
        parts.unshift(pc.plain("/me "));
    }

    return parts;
}
