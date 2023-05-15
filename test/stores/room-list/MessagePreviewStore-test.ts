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

import { mocked } from "jest-mock";
import { EventType, MatrixEvent, RelationType, Room } from "matrix-js-sdk/src/matrix";

import { MessagePreviewStore } from "../../../src/stores/room-list/MessagePreviewStore";
import { mkEvent, mkMessage, mkStubRoom, setupAsyncStoreWithClient, stubClient } from "../../test-utils";
import { DefaultTagID } from "../../../src/stores/room-list/models";

describe("MessagePreviewStore", () => {
    async function addEvent(
        store: MessagePreviewStore,
        room: Room,
        event: MatrixEvent,
        fireAction = true,
    ): Promise<void> {
        room.timeline.push(event);
        mocked(room.findEventById).mockImplementation((eventId) => room.timeline.find((e) => e.getId() === eventId));
        if (fireAction) {
            // @ts-ignore private access
            await store.onAction({
                action: "MatrixActions.Room.timeline",
                event,
                isLiveEvent: true,
                isLiveUnfilteredRoomTimelineEvent: true,
                room,
            });
        }
    }

    it("should ignore edits for events other than the latest one", async () => {
        const client = stubClient();
        const room = mkStubRoom("!roomId:server", "Room", client);
        mocked(client.getRoom).mockReturnValue(room);

        const store = MessagePreviewStore.testInstance();
        await store.start();
        await setupAsyncStoreWithClient(store, client);

        const firstMessage = mkMessage({
            user: "@sender:server",
            event: true,
            room: room.roomId,
            msg: "First message",
        });
        await addEvent(store, room, firstMessage, false);

        await expect(store.getPreviewForRoom(room, DefaultTagID.Untagged)).resolves.toMatchInlineSnapshot(
            `"@sender:server: First message"`,
        );

        const secondMessage = mkMessage({
            user: "@sender:server",
            event: true,
            room: room.roomId,
            msg: "Second message",
        });
        await addEvent(store, room, secondMessage);

        await expect(store.getPreviewForRoom(room, DefaultTagID.Untagged)).resolves.toMatchInlineSnapshot(
            `"@sender:server: Second message"`,
        );

        const firstMessageEdit = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: "@sender:server",
            room: room.roomId,
            content: {
                "body": "* First Message Edit",
                "m.new_content": {
                    body: "First Message Edit",
                },
                "m.relates_to": {
                    rel_type: RelationType.Replace,
                    event_id: firstMessage.getId()!,
                },
            },
        });
        await addEvent(store, room, firstMessageEdit);

        await expect(store.getPreviewForRoom(room, DefaultTagID.Untagged)).resolves.toMatchInlineSnapshot(
            `"@sender:server: Second message"`,
        );

        const secondMessageEdit = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: "@sender:server",
            room: room.roomId,
            content: {
                "body": "* Second Message Edit",
                "m.new_content": {
                    body: "Second Message Edit",
                },
                "m.relates_to": {
                    rel_type: RelationType.Replace,
                    event_id: secondMessage.getId()!,
                },
            },
        });
        await addEvent(store, room, secondMessageEdit);

        await expect(store.getPreviewForRoom(room, DefaultTagID.Untagged)).resolves.toMatchInlineSnapshot(
            `"@sender:server: Second Message Edit"`,
        );
    });

    it("should ignore edits to unknown events", async () => {
        const client = stubClient();
        const room = mkStubRoom("!roomId:server", "Room", client);
        mocked(client.getRoom).mockReturnValue(room);

        const store = MessagePreviewStore.testInstance();
        await store.start();
        await setupAsyncStoreWithClient(store, client);

        await expect(store.getPreviewForRoom(room, DefaultTagID.DM)).resolves.toMatchInlineSnapshot(`null`);

        const firstMessage = mkMessage({
            user: "@sender:server",
            event: true,
            room: room.roomId,
            msg: "First message",
        });
        await addEvent(store, room, firstMessage, true);

        await expect(store.getPreviewForRoom(room, DefaultTagID.DM)).resolves.toMatchInlineSnapshot(
            `"@sender:server: First message"`,
        );

        const randomEdit = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: "@sender:server",
            room: room.roomId,
            content: {
                "body": "* Second Message Edit",
                "m.new_content": {
                    body: "Second Message Edit",
                },
                "m.relates_to": {
                    rel_type: RelationType.Replace,
                    event_id: "!other-event:server",
                },
            },
        });
        await addEvent(store, room, randomEdit);

        await expect(store.getPreviewForRoom(room, DefaultTagID.Untagged)).resolves.toMatchInlineSnapshot(
            `"@sender:server: First message"`,
        );
    });

    it("should generate correct preview for message events in DMs", async () => {
        const client = stubClient();
        const room = mkStubRoom("!roomId:server", "Room", client);
        mocked(client.getRoom).mockReturnValue(room);
        room.currentState.getJoinedMemberCount = jest.fn().mockReturnValue(2);

        const store = MessagePreviewStore.testInstance();
        await store.start();
        await setupAsyncStoreWithClient(store, client);

        await expect(store.getPreviewForRoom(room, DefaultTagID.DM)).resolves.toMatchInlineSnapshot(`null`);

        const firstMessage = mkMessage({
            user: "@sender:server",
            event: true,
            room: room.roomId,
            msg: "First message",
        });
        await addEvent(store, room, firstMessage);

        await expect(store.getPreviewForRoom(room, DefaultTagID.DM)).resolves.toMatchInlineSnapshot(
            `"@sender:server: First message"`,
        );

        const secondMessage = mkMessage({
            user: "@sender:server",
            event: true,
            room: room.roomId,
            msg: "Second message",
        });
        await addEvent(store, room, secondMessage);

        await expect(store.getPreviewForRoom(room, DefaultTagID.DM)).resolves.toMatchInlineSnapshot(
            `"@sender:server: Second message"`,
        );
    });
});
