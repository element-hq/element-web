/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Room } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { LegacyCallInviteEventPreview } from "../../../../../src/stores/message-preview/previews/LegacyCallInviteEventPreview";
import { DefaultTagID } from "../../../../../src/stores/room-list-v3/skip-list/tag";
import { mkEvent, stubClient } from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";

describe("LegacyCallInviteEventPreview", () => {
    const preview = new LegacyCallInviteEventPreview();
    const roomId = "!room:example.com";

    beforeAll(() => {
        stubClient();
    });

    describe("getTextFor", () => {
        describe("in a room that should be prefixed (non-DM)", () => {
            it("returns 'You started a call' when the event is from self", () => {
                const selfUserId = MatrixClientPeg.safeGet().getSafeUserId();
                const event = mkEvent({
                    event: true,
                    type: "m.call.invite",
                    content: {},
                    user: selfUserId,
                    room: roomId,
                });
                expect(preview.getTextFor(event)).toBe("You started a call");
            });

            it("returns '<sender> started a call' when the event is from someone else", () => {
                const otherUserId = "@other:example.com";
                const event = mkEvent({
                    event: true,
                    type: "m.call.invite",
                    content: {},
                    user: otherUserId,
                    room: roomId,
                });
                expect(preview.getTextFor(event)).toBe(`${otherUserId} started a call`);
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

            it("returns 'Waiting for answer' when the event is from self", () => {
                const selfUserId = MatrixClientPeg.safeGet().getSafeUserId();
                const event = mkEvent({
                    event: true,
                    type: "m.call.invite",
                    content: {},
                    user: selfUserId,
                    room: roomId,
                });
                expect(preview.getTextFor(event, DefaultTagID.DM)).toBe("Waiting for answer");
            });

            it("returns '<sender> is calling' when the event is from someone else", () => {
                const otherUserId = "@other:example.com";
                const event = mkEvent({
                    event: true,
                    type: "m.call.invite",
                    content: {},
                    user: otherUserId,
                    room: roomId,
                });
                expect(preview.getTextFor(event, DefaultTagID.DM)).toBe(`${otherUserId} is calling`);
            });
        });
    });
});
