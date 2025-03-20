/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";
import { RuleId } from "matrix-js-sdk/src/matrix";
import { type Element as ParserElement } from "html-react-parser";
import { type ParentNode } from "domhandler/lib/node";
import { textContent } from "domutils";

import { AT_ROOM_REGEX, Pill, PillType } from "../components/views/elements/Pill";
import { parsePermalink } from "./permalinks/Permalinks";
import { type PermalinkParts } from "./permalinks/PermalinkConstructor";
import { jsxJoin } from "./ReactUtils.tsx";
import { type ReplacerMap } from "./reactHtmlParser.tsx";

/**
 * A node here is an A element with a href attribute tag.
 *
 * It should be pillified if the permalink parser returns a result and one of the following conditions match:
 * - Text content equals href. This is the case when sending a plain permalink inside a message.
 *   Composer completions already create an A tag.
 */
const shouldBePillified = (node: ParserElement, href: string, parts: PermalinkParts | null): boolean => {
    // permalink parser didn't return any parts
    if (!parts) return false;

    const text = textContent(node);

    if (href === text) return true;

    // event permalink with custom label
    if (parts.eventId) return false;

    return href.endsWith("/" + text);
};

const hasParentMatching = (node: ParserElement, matcher: (node: ParentNode | null) => boolean): boolean => {
    let parent = node.parentNode;
    while (parent) {
        if (matcher(parent)) return true;
        parent = parent.parentNode;
    }
    return false;
};

const isPreCode = (domNode: ParentNode | null): boolean =>
    (domNode as ParserElement)?.tagName === "PRE" || (domNode as ParserElement)?.tagName === "CODE";

export const pillifyMentionsReplacer: ReplacerMap = {
    a: (anchor, { room, shouldShowPillAvatar }) => {
        if (!room) return;

        const href = anchor.attribs["href"];
        if (href && !hasParentMatching(anchor, isPreCode) && shouldBePillified(anchor, href, parsePermalink(href))) {
            return <Pill url={href} inMessage={true} room={room} shouldShowPillAvatar={shouldShowPillAvatar} />;
        }
    },

    [Node.TEXT_NODE]: (text, { room, mxEvent, shouldShowPillAvatar }) => {
        if (!room || !mxEvent) return;

        const atRoomParts = text.data.split(AT_ROOM_REGEX);
        if (atRoomParts.length <= 1) return;

        const pushProcessor = new PushProcessor(room.client);
        const atRoomRule = pushProcessor.getPushRuleById(
            mxEvent.getContent()["m.mentions"] !== undefined ? RuleId.IsRoomMention : RuleId.AtRoomNotification,
        );
        if (atRoomRule && pushProcessor.ruleMatchesEvent(atRoomRule, mxEvent)) {
            const pill = (
                <Pill
                    type={PillType.AtRoomMention}
                    inMessage={true}
                    room={room}
                    shouldShowPillAvatar={shouldShowPillAvatar}
                />
            );

            return jsxJoin(atRoomParts, pill);
        }
    },
};

/**
 * Marks the text that activated a push-notification keyword pattern.
 */
export const pillifyKeywordsReplacer: ReplacerMap = {
    [Node.TEXT_NODE]: (text, { keywordRegexpPattern }) => {
        if (!keywordRegexpPattern) return;

        const textContent = text.data;
        if (!textContent) return;

        const match = textContent.match(keywordRegexpPattern);
        if (!match || match.length < 3) return;

        const keywordText = match[2];
        const idx = match.index! + match[1].length;
        const before = textContent.substring(0, idx);
        const after = textContent.substring(idx + keywordText.length);

        return (
            <>
                {before}
                <Pill text={keywordText} type={PillType.Keyword} />
                {after}
            </>
        );
    },
};
