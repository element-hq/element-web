/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { RelationType, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { mkEvent, stubClient } from "../../../test-utils";
import { ReactionEventPreview } from "../../../../src/stores/room-list/previews/ReactionEventPreview";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";

describe("ReactionEventPreview", () => {
    const preview = new ReactionEventPreview();
    const userId = "@user:example.com";
    const roomId = "!room:example.com";

    beforeAll(() => {
        stubClient();
    });

    describe("getTextFor", () => {
        it("should return null for non-relations", () => {
            const event = mkEvent({
                event: true,
                content: {},
                user: userId,
                type: "m.room.message",
                room: roomId,
            });
            expect(preview.getTextFor(event)).toBeNull();
        });

        it("should return null for non-reactions", () => {
            const event = mkEvent({
                event: true,
                content: {
                    "body": "",
                    "m.relates_to": {
                        rel_type: RelationType.Thread,
                        event_id: "$foo:bar",
                    },
                },
                user: userId,
                type: "m.room.message",
                room: roomId,
            });
            expect(preview.getTextFor(event)).toBeNull();
        });

        it("should use 'You' for your own reactions", () => {
            const cli = MatrixClientPeg.safeGet();
            const room = new Room(roomId, cli, userId);
            mocked(cli.getRoom).mockReturnValue(room);

            const message = mkEvent({
                event: true,
                content: {
                    "body": "duck duck goose",
                    "m.relates_to": {
                        rel_type: RelationType.Thread,
                        event_id: "$foo:bar",
                    },
                },
                user: userId,
                type: "m.room.message",
                room: roomId,
            });

            room.getUnfilteredTimelineSet().addLiveEvent(message, {});

            const event = mkEvent({
                event: true,
                content: {
                    "m.relates_to": {
                        rel_type: RelationType.Annotation,
                        key: "🪿",
                        event_id: message.getId(),
                    },
                },
                user: cli.getSafeUserId(),
                type: "m.reaction",
                room: roomId,
            });
            expect(preview.getTextFor(event)).toMatchInlineSnapshot(`"You reacted 🪿 to duck duck goose"`);
        });

        it("should use display name for your others' reactions", () => {
            const cli = MatrixClientPeg.safeGet();
            const room = new Room(roomId, cli, userId);
            mocked(cli.getRoom).mockReturnValue(room);

            const message = mkEvent({
                event: true,
                content: {
                    "body": "duck duck goose",
                    "m.relates_to": {
                        rel_type: RelationType.Thread,
                        event_id: "$foo:bar",
                    },
                },
                user: userId,
                type: "m.room.message",
                room: roomId,
            });

            room.getUnfilteredTimelineSet().addLiveEvent(message, {});

            const event = mkEvent({
                event: true,
                content: {
                    "m.relates_to": {
                        rel_type: RelationType.Annotation,
                        key: "🪿",
                        event_id: message.getId(),
                    },
                },
                user: userId,
                type: "m.reaction",
                room: roomId,
            });
            event.sender = new RoomMember(roomId, userId);
            event.sender.name = "Bob";

            expect(preview.getTextFor(event)).toMatchInlineSnapshot(`"Bob reacted 🪿 to duck duck goose"`);
        });
    });
});
