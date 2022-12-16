/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { RelationType } from "matrix-js-sdk/src/matrix";

import { MessageEventPreview } from "../../../../src/stores/room-list/previews/MessageEventPreview";
import { mkEvent, stubClient } from "../../../test-utils";

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

        it("when called with a broadcast chunk event it should return null", () => {
            const event = mkEvent({
                event: true,
                content: {
                    body: "test body",
                    ["io.element.voice_broadcast_chunk"]: {},
                },
                user: userId,
                type: "m.room.message",
            });
            expect(preview.getTextFor(event)).toBeNull();
        });
    });
});
