/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { RelationType } from "matrix-js-sdk/src/matrix";

import { MessageEventPreview } from "../../../../../src/stores/room-list/previews/MessageEventPreview";
import { mkEvent, stubClient } from "../../../../test-utils";

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
    });
});
