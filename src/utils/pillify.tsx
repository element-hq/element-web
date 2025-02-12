/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { StrictMode } from "react";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";
import { type MatrixClient, type MatrixEvent, RuleId } from "matrix-js-sdk/src/matrix";
import { TooltipProvider } from "@vector-im/compound-web";

import SettingsStore from "../settings/SettingsStore";
import { Pill, pillRoomNotifLen, pillRoomNotifPos, PillType } from "../components/views/elements/Pill";
import { parsePermalink } from "./permalinks/Permalinks";
import { type PermalinkParts } from "./permalinks/PermalinkConstructor";
import { type ReactRootManager } from "./react";

/**
 * A node here is an A element with a href attribute tag.
 *
 * It should be pillified if the permalink parser returns a result and one of the following conditions match:
 * - Text content equals href. This is the case when sending a plain permalink inside a message.
 * - The link does not have the "linkified" class.
 *   Composer completions already create an A tag.
 *   Linkify will not linkify things again. → There won't be a "linkified" class.
 */
const shouldBePillified = (node: Element, href: string, parts: PermalinkParts | null): boolean => {
    // permalink parser didn't return any parts
    if (!parts) return false;

    const textContent = node.textContent;

    // event permalink with custom label
    if (parts.eventId && href !== textContent) return false;

    return href === textContent || !node.classList.contains("linkified");
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
export function pillifyLinks(
    matrixClient: MatrixClient,
    nodes: ArrayLike<Element>,
    mxEvent: MatrixEvent,
    pills: ReactRootManager,
): void {
    const room = matrixClient.getRoom(mxEvent.getRoomId()) ?? undefined;
    const shouldShowPillAvatar = SettingsStore.getValue("Pill.shouldShowPillAvatar");
    let node = nodes[0];
    while (node) {
        let pillified = false;

        if (node.tagName === "PRE" || node.tagName === "CODE" || pills.elements.includes(node)) {
            // Skip code blocks and existing pills
            node = node.nextSibling as Element;
            continue;
        } else if (node.tagName === "A" && node.getAttribute("href")) {
            const href = node.getAttribute("href")!;
            const parts = parsePermalink(href);

            if (shouldBePillified(node, href, parts)) {
                const pillContainer = document.createElement("span");

                const pill = (
                    <StrictMode>
                        <TooltipProvider>
                            <Pill url={href} inMessage={true} room={room} shouldShowPillAvatar={shouldShowPillAvatar} />
                        </TooltipProvider>
                    </StrictMode>
                );

                pills.render(pill, pillContainer, node);
                node.replaceWith(pillContainer);
                // Pills within pills aren't going to go well, so move on
                pillified = true;

                // update the current node with one that's now taken its place
                node = pillContainer;
            }
        } else if (
            node.nodeType === Node.TEXT_NODE &&
            // as applying pills happens outside of react, make sure we're not doubly
            // applying @room pills here, as a rerender with the same content won't touch the DOM
            // to clear the pills from the last run of pillifyLinks
            !node.parentElement?.classList.contains("mx_AtRoomPill")
        ) {
            let currentTextNode = node as Node as Text | null;
            const roomNotifTextNodes: Text[] = [];

            // Take a textNode and break it up to make all the instances of @room their
            // own textNode, adding those nodes to roomNotifTextNodes
            while (currentTextNode !== null) {
                const roomNotifPos = pillRoomNotifPos(currentTextNode.textContent);
                let nextTextNode: Text | null = null;
                if (roomNotifPos > -1) {
                    let roomTextNode = currentTextNode;

                    if (roomNotifPos > 0) roomTextNode = roomTextNode.splitText(roomNotifPos);
                    if (roomTextNode.textContent && roomTextNode.textContent.length > pillRoomNotifLen()) {
                        nextTextNode = roomTextNode.splitText(pillRoomNotifLen());
                    }
                    roomNotifTextNodes.push(roomTextNode);
                }
                currentTextNode = nextTextNode;
            }

            if (roomNotifTextNodes.length > 0) {
                const pushProcessor = new PushProcessor(matrixClient);
                const atRoomRule = pushProcessor.getPushRuleById(
                    mxEvent.getContent()["m.mentions"] !== undefined ? RuleId.IsRoomMention : RuleId.AtRoomNotification,
                );
                if (atRoomRule && pushProcessor.ruleMatchesEvent(atRoomRule, mxEvent)) {
                    // Now replace all those nodes with Pills
                    for (const roomNotifTextNode of roomNotifTextNodes) {
                        // Set the next node to be processed to the one after the node
                        // we're adding now, since we've just inserted nodes into the structure
                        // we're iterating over.
                        // Note we've checked roomNotifTextNodes.length > 0 so we'll do this at least once
                        node = roomNotifTextNode.nextSibling as Element;

                        const pillContainer = document.createElement("span");
                        const pill = (
                            <StrictMode>
                                <TooltipProvider>
                                    <Pill
                                        type={PillType.AtRoomMention}
                                        inMessage={true}
                                        room={room}
                                        shouldShowPillAvatar={shouldShowPillAvatar}
                                    />
                                </TooltipProvider>
                            </StrictMode>
                        );

                        pills.render(pill, pillContainer, roomNotifTextNode);
                        roomNotifTextNode.replaceWith(pillContainer);
                    }
                    // Nothing else to do for a text node (and we don't need to advance
                    // the loop pointer because we did it above)
                    continue;
                }
            }
        }

        if (node.childNodes && node.childNodes.length && !pillified) {
            pillifyLinks(matrixClient, node.childNodes as NodeListOf<Element>, mxEvent, pills);
        }

        node = node.nextSibling as Element;
    }
}
