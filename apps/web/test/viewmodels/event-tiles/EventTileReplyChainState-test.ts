/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { mkMessage } from "../../test-utils";
import { getEventTileReplyChainState } from "../../../src/viewmodels/room/timeline/event-tile/EventTileReplyChainState";

const roomId = "!room:example.org";

function makeMessage(): MatrixEvent {
    return mkMessage({
        room: roomId,
        user: "@alice:example.org",
        msg: "Message",
        event: true,
    });
}

function makeReply(): MatrixEvent {
    const parentEvent = makeMessage();

    return mkMessage({
        room: roomId,
        user: "@bob:example.org",
        msg: "Reply",
        event: true,
        relatesTo: {
            "m.in_reply_to": {
                event_id: parentEvent.getId(),
            },
        },
    });
}

describe("EventTileReplyChainState", () => {
    it("does not show a reply chain when the event has no renderer", () => {
        const state = getEventTileReplyChainState({
            mxEvent: makeReply(),
            hasRenderer: false,
        });

        expect(state.shouldShowReplyChain).toBe(false);
    });

    it("does not show a reply chain for non-reply events", () => {
        const state = getEventTileReplyChainState({
            mxEvent: makeMessage(),
            hasRenderer: true,
        });

        expect(state.shouldShowReplyChain).toBe(false);
    });

    it("shows a reply chain for reply events with a renderer", () => {
        const state = getEventTileReplyChainState({
            mxEvent: makeReply(),
            hasRenderer: true,
        });

        expect(state.shouldShowReplyChain).toBe(true);
    });

    it("does not show a reply chain for redacted reply events", () => {
        const replyEvent = makeReply();
        jest.spyOn(replyEvent, "isRedacted").mockReturnValue(true);

        const state = getEventTileReplyChainState({
            mxEvent: replyEvent,
            hasRenderer: true,
        });

        expect(state.shouldShowReplyChain).toBe(false);
    });
});
