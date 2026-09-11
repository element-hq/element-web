/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { Room } from "matrix-js-sdk/src/matrix";
import { mkEvent, stubClient } from "test-utils";

import { StickerEventPreview } from "./StickerEventPreview";
import { DefaultTagID } from "../../room-list-v3/skip-list/tag";
import { MatrixClientPeg } from "../../../MatrixClientPeg";

describe("StickerEventPreview", () => {
    const preview = new StickerEventPreview();
    const roomId = "!room:example.com";

    beforeAll(() => {
        stubClient();
    });

    describe("getTextFor", () => {
        it("returns null when the event has no body", () => {
            const event = mkEvent({
                event: true,
                type: "m.sticker",
                content: {},
                user: "@other:example.com",
                room: roomId,
            });
            expect(preview.getTextFor(event)).toBeNull();
        });

        it("returns null when the body is an empty string", () => {
            const event = mkEvent({
                event: true,
                type: "m.sticker",
                content: { body: "" },
                user: "@other:example.com",
                room: roomId,
            });
            expect(preview.getTextFor(event)).toBeNull();
        });

        describe("in a room that should be prefixed (non-DM)", () => {
            // Default stub: getRoom returns null → shouldPrefixMessagesIn returns true

            it("returns '<sender>: <stickerName>' when the event is from someone else", () => {
                const otherUserId = "@other:example.com";
                const event = mkEvent({
                    event: true,
                    type: "m.sticker",
                    content: { body: "wave" },
                    user: otherUserId,
                    room: roomId,
                });
                expect(preview.getTextFor(event)).toBe(`${otherUserId}: wave`);
            });

            it("returns just the sticker name when the event is from self", () => {
                const selfUserId = MatrixClientPeg.safeGet().getSafeUserId();
                const event = mkEvent({
                    event: true,
                    type: "m.sticker",
                    content: { body: "wave" },
                    user: selfUserId,
                    room: roomId,
                });
                expect(preview.getTextFor(event)).toBe("wave");
            });
        });

        describe("in a DM room (should not be prefixed)", () => {
            beforeEach(() => {
                const cli = MatrixClientPeg.safeGet();
                // Make a 1:1 room so shouldPrefixMessagesIn returns false
                const room = new Room(roomId, cli, cli.getSafeUserId());
                vi.spyOn(room.currentState, "getJoinedMemberCount").mockReturnValue(2);
                vi.mocked(cli.getRoom).mockReturnValue(room);
            });

            afterEach(() => {
                vi.mocked(MatrixClientPeg.safeGet().getRoom).mockReturnValue(null);
            });

            it("returns just the sticker name regardless of sender", () => {
                const otherUserId = "@other:example.com";
                const event = mkEvent({
                    event: true,
                    type: "m.sticker",
                    content: { body: "wave" },
                    user: otherUserId,
                    room: roomId,
                });
                expect(preview.getTextFor(event, DefaultTagID.DM)).toBe("wave");
            });
        });

        describe("in a thread", () => {
            it("returns just the sticker name regardless of sender", () => {
                const otherUserId = "@other:example.com";
                const event = mkEvent({
                    event: true,
                    type: "m.sticker",
                    content: { body: "wave" },
                    user: otherUserId,
                    room: roomId,
                });
                expect(preview.getTextFor(event, undefined, true)).toBe("wave");
            });
        });
    });
});
