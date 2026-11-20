/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeAll } from "vitest";
import { RelationType } from "matrix-js-sdk/src/matrix";
import { DecryptionFailureCode } from "matrix-js-sdk/src/crypto-api";
import { mkDecryptionFailureMatrixEvent } from "matrix-js-sdk/src/testing";
import { mkEvent, stubClient } from "test-utils";

// Import directly from the file to avoid circular dependencies with MessagePreviewStore
import { MessageEventPreview } from "./MessageEventPreview";

describe("MessageEventPreview", () => {
    const preview = new MessageEventPreview();
    const userId = "@user:example.com";

    beforeAll(() => {
        stubClient();
    });

    describe("getTextFor", () => {
        it("when called with an event with empty content should return null", () => {
            const event = mkEvent({
                event: true,
                content: {},
                user: userId,
                type: "m.room.message",
            });
            expect(preview.getTextFor(event)).toBeNull();
        });

        it("when called with an event with empty body should return null", () => {
            const event = mkEvent({
                event: true,
                content: {
                    body: "",
                },
                user: userId,
                type: "m.room.message",
            });
            expect(preview.getTextFor(event)).toBeNull();
        });

        it("when called with an event with body should return »user: body«", () => {
            const event = mkEvent({
                event: true,
                content: {
                    body: "test body",
                },
                user: userId,
                type: "m.room.message",
            });
            expect(preview.getTextFor(event)).toBe(`${userId}: test body`);
        });

        it("when called for a replaced event with new content should return the new content body", () => {
            const event = mkEvent({
                event: true,
                content: {
                    ["m.new_content"]: {
                        body: "test new content body",
                    },
                    ["m.relates_to"]: {
                        rel_type: RelationType.Replace,
                        event_id: "$asd123",
                    },
                },
                user: userId,
                type: "m.room.message",
            });
            expect(preview.getTextFor(event)).toBe(`${userId}: test new content body`);
        });

        describe("for a gallery", () => {
            const itemtypes = [
                { itemtype: "m.image", body: "one.png", url: "mxc://server/one" },
                { itemtype: "m.video", body: "two.mp4", url: "mxc://server/two" },
            ];

            it("should return the caption", () => {
                const event = mkEvent({
                    event: true,
                    content: { msgtype: "dm.filament.gallery", body: "Our holiday", itemtypes },
                    user: userId,
                    type: "m.room.message",
                });
                expect(preview.getTextFor(event)).toBe(`${userId}: Our holiday`);
            });

            it("should return the formatted caption without its markup", () => {
                const event = mkEvent({
                    event: true,
                    content: {
                        msgtype: "dm.filament.gallery",
                        body: "Our **holiday**",
                        format: "org.matrix.custom.html",
                        formatted_body: "Our <strong>holiday</strong>",
                        itemtypes,
                    },
                    user: userId,
                    type: "m.room.message",
                });
                expect(preview.getTextFor(event)).toBe(`${userId}: Our holiday`);
            });

            it.each(["dm.filament.gallery", "m.gallery"])(
                "should count the items of a %s without a caption",
                (msgtype) => {
                    const event = mkEvent({
                        event: true,
                        content: { msgtype, body: "", itemtypes },
                        user: userId,
                        type: "m.room.message",
                    });
                    expect(preview.getTextFor(event)).toBe(`${userId}: Gallery with 2 items`);
                },
            );

            it("should count the items when the body is missing or blank", () => {
                for (const body of [undefined, "   "]) {
                    const event = mkEvent({
                        event: true,
                        content: { msgtype: "dm.filament.gallery", body, itemtypes },
                        user: userId,
                        type: "m.room.message",
                    });
                    expect(preview.getTextFor(event)).toBe(`${userId}: Gallery with 2 items`);
                }
            });

            it("should not prefix the sender in a thread", () => {
                const event = mkEvent({
                    event: true,
                    content: { msgtype: "dm.filament.gallery", body: "", itemtypes },
                    user: userId,
                    type: "m.room.message",
                });
                expect(preview.getTextFor(event, undefined, true)).toBe("Gallery with 2 items");
            });

            it("should preview the new content of an edit", () => {
                const edit = (body: string) =>
                    mkEvent({
                        event: true,
                        content: {
                            "msgtype": "m.text",
                            "body": "* fallback",
                            "m.new_content": { msgtype: "dm.filament.gallery", body, itemtypes: itemtypes.slice(0, 1) },
                            "m.relates_to": { rel_type: RelationType.Replace, event_id: "$asd123" },
                        },
                        user: userId,
                        type: "m.room.message",
                    });

                expect(preview.getTextFor(edit("New caption"))).toBe(`${userId}: New caption`);
                expect(preview.getTextFor(edit(""))).toBe(`${userId}: Gallery with 1 item`);
            });
        });

        it("should return »user: Unable to decrypt message« for a decryption failure", async () => {
            const event = await mkDecryptionFailureMatrixEvent({
                code: DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID,
                msg: "The sender's device has not sent us the keys for this message.",
                roomId: "!room:example.com",
                sender: userId,
            });
            expect(preview.getTextFor(event)).toBe(`${userId}: Unable to decrypt message`);
        });
    });
});
