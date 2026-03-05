/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Room } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { LegacyCallHangupEvent } from "../../../../../src/stores/message-preview/previews/LegacyCallHangupEvent";
import { DefaultTagID } from "../../../../../src/stores/room-list-v3/skip-list/tag";
import { mkEvent, stubClient } from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";

describe("LegacyCallHangupEvent", () => {
    const preview = new LegacyCallHangupEvent();
    const roomId = "!room:example.com";

    beforeAll(() => {
        stubClient();
    });

    describe("getTextFor", () => {
        describe("in a room that should be prefixed (non-DM)", () => {
            it("returns 'You ended the call' when the event is from self", () => {
                const selfUserId = MatrixClientPeg.safeGet().getSafeUserId();
                const event = mkEvent({
                    event: true,
                    type: "m.call.hangup",
                    content: {},
                    user: selfUserId,
                    room: roomId,
                });
                expect(preview.getTextFor(event)).toBe("You ended the call");
            });

            it("returns '<sender> ended the call' when the event is from someone else", () => {
                const otherUserId = "@other:example.com";
                const event = mkEvent({
                    event: true,
                    type: "m.call.hangup",
                    content: {},
                    user: otherUserId,
                    room: roomId,
                });
                expect(preview.getTextFor(event)).toBe(`${otherUserId} ended the call`);
            });
        });

        describe("in a DM room (should not be prefixed)", () => {
            beforeEach(() => {
                const cli = MatrixClientPeg.safeGet();
                // Make a 1:1 room so shouldPrefixMessagesIn returns false
                const room = new Room(roomId, cli, cli.getSafeUserId());
                jest.spyOn(room.currentState, "getJoinedMemberCount").mockReturnValue(2);
                mocked(cli.getRoom).mockReturnValue(room);
            });

            afterEach(() => {
                mocked(MatrixClientPeg.safeGet().getRoom).mockReturnValue(null);
            });

            it("returns 'Call ended' regardless of sender", () => {
                const otherUserId = "@other:example.com";
                const event = mkEvent({
                    event: true,
                    type: "m.call.hangup",
                    content: {},
                    user: otherUserId,
                    room: roomId,
                });
                expect(preview.getTextFor(event, DefaultTagID.DM)).toBe("Call ended");
            });
        });
    });
});
