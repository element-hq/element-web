/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Room } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { LegacyCallAnswerEventPreview } from "../../../../../src/stores/message-preview/previews/LegacyCallAnswerEventPreview";
import { DefaultTagID } from "../../../../../src/stores/room-list-v3/skip-list/tag";
import { mkEvent, stubClient } from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";

describe("LegacyCallAnswerEventPreview", () => {
    const preview = new LegacyCallAnswerEventPreview();
    const roomId = "!room:example.com";

    beforeAll(() => {
        stubClient();
    });

    describe("getTextFor", () => {
        describe("in a room that should be prefixed (non-DM)", () => {
            // Default stub: getRoom returns null → shouldPrefixMessagesIn returns true

            it("returns 'You joined the call' when the event is from self", () => {
                const selfUserId = MatrixClientPeg.safeGet().getSafeUserId();
                const event = mkEvent({
                    event: true,
                    type: "m.call.answer",
                    content: {},
                    user: selfUserId,
                    room: roomId,
                });
                expect(preview.getTextFor(event)).toBe("You joined the call");
            });

            it("returns '<sender> joined the call' when the event is from someone else", () => {
                const otherUserId = "@other:example.com";
                const event = mkEvent({
                    event: true,
                    type: "m.call.answer",
                    content: {},
                    user: otherUserId,
                    room: roomId,
                });
                expect(preview.getTextFor(event)).toBe(`${otherUserId} joined the call`);
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

            it("returns 'Call in progress' regardless of sender", () => {
                const otherUserId = "@other:example.com";
                const event = mkEvent({
                    event: true,
                    type: "m.call.answer",
                    content: {},
                    user: otherUserId,
                    room: roomId,
                });
                expect(preview.getTextFor(event, DefaultTagID.DM)).toBe("Call in progress");
            });
        });
    });
});
