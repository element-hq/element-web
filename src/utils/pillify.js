/*
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

import React from "react";
import ReactDOM from 'react-dom';
import {MatrixClientPeg} from '../MatrixClientPeg';
import SettingsStore from "../settings/SettingsStore";
import {PushProcessor} from 'matrix-js-sdk/src/pushprocessor';
import * as sdk from '../index';

/**
 * Recurses depth-first through a DOM tree, converting matrix.to links
 * into pills based on the context of a given room.  Returns a list of
 * the resulting React nodes so they can be unmounted rather than leaking.
 *
 * @param {Node[]} nodes - a list of sibling DOM nodes to traverse to try
 *   to turn into pills.
 * @param {MatrixEvent} mxEvent - the matrix event which the DOM nodes are
 *   part of representing.
 * @param {Node[]} pills: an accumulator of the DOM nodes which contain
 *   React components which have been mounted as part of this.
 *   The initial caller should pass in an empty array to seed the accumulator.
 */
export function pillifyLinks(nodes, mxEvent, pills) {
    const room = MatrixClientPeg.get().getRoom(mxEvent.getRoomId());
    const shouldShowPillAvatar = SettingsStore.getValue("Pill.shouldShowPillAvatar");
    let node = nodes[0];
    while (node) {
        let pillified = false;

        if (node.tagName === "A" && node.getAttribute("href")) {
            const href = node.getAttribute("href");

            // If the link is a (localised) matrix.to link, replace it with a pill
            const Pill = sdk.getComponent('elements.Pill');
            if (Pill.isMessagePillUrl(href)) {
                const pillContainer = document.createElement('span');

                const pill = <Pill
                    url={href}
                    inMessage={true}
                    room={room}
                    shouldShowPillAvatar={shouldShowPillAvatar}
                />;

                ReactDOM.render(pill, pillContainer);
                node.parentNode.replaceChild(pillContainer, node);
                pills.push(pillContainer);
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
            !node.parentElement.classList.contains("mx_AtRoomPill")
        ) {
            const Pill = sdk.getComponent('elements.Pill');

            let currentTextNode = node;
            const roomNotifTextNodes = [];

            // Take a textNode and break it up to make all the instances of @room their
            // own textNode, adding those nodes to roomNotifTextNodes
            while (currentTextNode !== null) {
                const roomNotifPos = Pill.roomNotifPos(currentTextNode.textContent);
                let nextTextNode = null;
                if (roomNotifPos > -1) {
                    let roomTextNode = currentTextNode;

                    if (roomNotifPos > 0) roomTextNode = roomTextNode.splitText(roomNotifPos);
                    if (roomTextNode.textContent.length > Pill.roomNotifLen()) {
                        nextTextNode = roomTextNode.splitText(Pill.roomNotifLen());
                    }
                    roomNotifTextNodes.push(roomTextNode);
                }
                currentTextNode = nextTextNode;
            }

            if (roomNotifTextNodes.length > 0) {
                const pushProcessor = new PushProcessor(MatrixClientPeg.get());
                const atRoomRule = pushProcessor.getPushRuleById(".m.rule.roomnotif");
                if (atRoomRule && pushProcessor.ruleMatchesEvent(atRoomRule, mxEvent)) {
                    // Now replace all those nodes with Pills
                    for (const roomNotifTextNode of roomNotifTextNodes) {
                        // Set the next node to be processed to the one after the node
                        // we're adding now, since we've just inserted nodes into the structure
                        // we're iterating over.
                        // Note we've checked roomNotifTextNodes.length > 0 so we'll do this at least once
                        node = roomNotifTextNode.nextSibling;

                        const pillContainer = document.createElement('span');
                        const pill = <Pill
                            type={Pill.TYPE_AT_ROOM_MENTION}
                            inMessage={true}
                            room={room}
                            shouldShowPillAvatar={shouldShowPillAvatar}
                        />;

                        ReactDOM.render(pill, pillContainer);
                        roomNotifTextNode.parentNode.replaceChild(pillContainer, roomNotifTextNode);
                        pills.push(pillContainer);
                    }
                    // Nothing else to do for a text node (and we don't need to advance
                    // the loop pointer because we did it above)
                    continue;
                }
            }
        }

        if (node.childNodes && node.childNodes.length && !pillified) {
            pillifyLinks(node.childNodes, mxEvent, pills);
        }

        node = node.nextSibling;
    }
}

/**
 * Unmount all the pill containers from React created by pillifyLinks.
 *
 * It's critical to call this after pillifyLinks, otherwise
 * Pills will leak, leaking entire DOM trees via the event
 * emitter on BaseAvatar as per
 * https://github.com/vector-im/element-web/issues/12417
 *
 * @param {Node[]} pills - array of pill containers whose React
 *   components should be unmounted.
 */
export function unmountPills(pills) {
    for (const pillContainer of pills) {
        ReactDOM.unmountComponentAtNode(pillContainer);
    }
}
