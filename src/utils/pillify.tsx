/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";
import { type MatrixEvent, type Room, RuleId } from "matrix-js-sdk/src/matrix";
import { Element as ParserElement, type DOMNode } from "html-react-parser";
import { type ParentNode } from "domhandler/lib/node";

import { Pill, PillType } from "../components/views/elements/Pill";
import { parsePermalink } from "./permalinks/Permalinks";
import { type PermalinkParts } from "./permalinks/PermalinkConstructor";

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

    const textContent = node.children.find((child) => child.type === "text")?.data ?? "";

    // event permalink with custom label
    if (parts.eventId && href !== textContent) return false;

    return href.endsWith("/" + textContent);
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

const AtRoomMention = "@room";

export const pillifyLinksReplacer =
    (mxEvent: MatrixEvent, room: Room | undefined, shouldShowPillAvatar: boolean) => (domNode: DOMNode) => {
        if (
            domNode instanceof ParserElement &&
            domNode.tagName.toUpperCase() === "A" &&
            domNode.attribs["href"] &&
            !hasParentMatching(domNode, isPreCode) &&
            shouldBePillified(domNode, domNode.attribs["href"], parsePermalink(domNode.attribs["href"]))
        ) {
            return (
                <Pill
                    url={domNode.attribs["href"]}
                    inMessage={true}
                    room={room}
                    shouldShowPillAvatar={shouldShowPillAvatar}
                />
            );
        } else if (room && domNode.type === "text" && domNode.data.includes(AtRoomMention)) {
            const pill = (
                <Pill
                    type={PillType.AtRoomMention}
                    inMessage={true}
                    room={room}
                    shouldShowPillAvatar={shouldShowPillAvatar}
                />
            );
            const split = domNode.data.split(AtRoomMention);
            const parts = split.map((part, index) => (
                <React.Fragment key={index}>
                    {part}
                    {index < split.length - 1 ? pill : null}
                </React.Fragment>
            ));

            if (parts.length > 0) {
                const pushProcessor = new PushProcessor(room.client);
                const atRoomRule = pushProcessor.getPushRuleById(
                    mxEvent.getContent()["m.mentions"] !== undefined ? RuleId.IsRoomMention : RuleId.AtRoomNotification,
                );
                if (atRoomRule && pushProcessor.ruleMatchesEvent(atRoomRule, mxEvent)) {
                    return <React.Fragment>{parts}</React.Fragment>;
                }
            }
        }
    };

/**
 * Recurses depth-first through a DOM tree, converting matrix.to links
 * into pills based on the context of a given room.  Returns a list of
 * the resulting React nodes so they can be unmounted rather than leaking.
 *
 * @param matrixClient the client of the logged-in user
 * @param {Element[]} nodes - a list of sibling DOM nodes to traverse to try
 *   to turn into pills.
 * @param {MatrixEvent} mxEvent - the matrix event which the DOM nodes are
 *   part of representing.
 * @param {ReactRootManager} pills - an accumulator of the DOM nodes which contain
 *   React components which have been mounted as part of this.
 *   The initial caller should pass in an empty array to seed the accumulator.
 */
