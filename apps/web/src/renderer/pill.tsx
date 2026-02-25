/*
Copyright 2024-2025 New Vector Ltd.
Copyright 2019-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { RuleId } from "matrix-js-sdk/src/matrix";
import { type Element } from "html-react-parser";
import { textContent } from "domutils";
import reactStringReplace from "react-string-replace";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";

import { Pill, PillType } from "../components/views/elements/Pill";
import { parsePermalink } from "../utils/permalinks/Permalinks";
import { type PermalinkParts } from "../utils/permalinks/PermalinkConstructor";
import { hasParentMatching, type RendererMap, type ParentNode } from "./utils.tsx";

const AT_ROOM_REGEX = PushProcessor.getPushRuleGlobRegex("@room", true, "gmi");

/**
 * A node here is an A element with a href attribute tag.
 *
 * It should be pillified if the permalink parser returns a result and one of the following conditions match:
 * - Text content equals href. This is the case when sending a plain permalink inside a message.
 * - The link is not from linkify (isHtml=true).
 *   Composer completions already create an A tag.
 */
const shouldBePillified = (node: Element, href: string, parts: PermalinkParts | null, isHtml: boolean): boolean => {
    // permalink parser didn't return any parts
    if (!parts) return false;

    const text = textContent(node);

    // event permalink with custom label
    if (parts.eventId && href !== text) return false;

    return href === text || isHtml;
};

const isPreCode = (domNode: ParentNode | null): boolean =>
    (domNode as Element)?.tagName === "PRE" || (domNode as Element)?.tagName === "CODE";

/**
 * Marks the text that activated a push-notification mention pattern.
 */
export const mentionPillRenderer: RendererMap = {
    a: (anchor, { room, shouldShowPillAvatar, isHtml }) => {
        if (!room) return;

        const href = anchor.attribs["href"];
        if (
            href &&
            !hasParentMatching(anchor, isPreCode) &&
            shouldBePillified(anchor, href, parsePermalink(href), isHtml)
        ) {
            return <Pill url={href} inMessage={true} room={room} shouldShowPillAvatar={shouldShowPillAvatar} />;
        }
    },

    [Node.TEXT_NODE]: (text, { room, mxEvent, shouldShowPillAvatar }) => {
        if (!room || !mxEvent) return;

        const atRoomRule = room.client.pushProcessor.getPushRuleById(
            mxEvent.getContent()["m.mentions"] !== undefined ? RuleId.IsRoomMention : RuleId.AtRoomNotification,
        );
        if (atRoomRule && room.client.pushProcessor.ruleMatchesEvent(atRoomRule, mxEvent)) {
            const parts = reactStringReplace(text.data, AT_ROOM_REGEX, (_match, i) => (
                <Pill
                    key={i}
                    type={PillType.AtRoomMention}
                    inMessage={true}
                    room={room}
                    shouldShowPillAvatar={shouldShowPillAvatar}
                />
            ));

            if (parts.length <= 1) return; // no matches, skip replacing

            return <>{parts}</>;
        }
    },
};

/**
 * Marks the text that activated a push-notification keyword pattern.
 */
export const keywordPillRenderer: RendererMap = {
    [Node.TEXT_NODE]: (text, { keywordRegexpPattern }) => {
        if (!keywordRegexpPattern) return;

        const parts = reactStringReplace(text.data, keywordRegexpPattern, (match, i) => (
            <Pill key={i} text={match} type={PillType.Keyword} />
        ));

        if (parts.length <= 1) return; // no matches, skip replacing

        return <>{parts}</>;
    },
};
