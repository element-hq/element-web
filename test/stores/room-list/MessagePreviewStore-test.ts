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

import { Mocked, mocked } from "jest-mock";
import { EventTimeline, EventType, MatrixClient, MatrixEvent, RelationType, Room } from "matrix-js-sdk/src/matrix";

import { MessagePreviewStore } from "../../../src/stores/room-list/MessagePreviewStore";
import { mkEvent, mkMessage, mkReaction, setupAsyncStoreWithClient, stubClient } from "../../test-utils";
import { DefaultTagID } from "../../../src/stores/room-list/models";
import { mkThread } from "../../test-utils/threads";

describe("MessagePreviewStore", () => {
    let client: Mocked<MatrixClient>;
    let room: Room;
    let store: MessagePreviewStore;

    async function addEvent(
        store: MessagePreviewStore,
        room: Room,
        event: MatrixEvent,
        fireAction = true,
    ): Promise<void> {
        room.addLiveEvents([event]);
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

    beforeEach(async () => {
        client = mocked(stubClient());
        room = new Room("!roomId:server", client, client.getSafeUserId());
        mocked(client.getRoom).mockReturnValue(room);

        store = MessagePreviewStore.testInstance();
        await store.start();
        await setupAsyncStoreWithClient(store, client);
    });

    it("should ignore edits for events other than the latest one", async () => {
        const firstMessage = mkMessage({
            user: "@sender:server",
            event: true,
            room: room.roomId,
            msg: "First message",
        });
        await addEvent(store, room, firstMessage, false);

        expect((await store.getPreviewForRoom(room, DefaultTagID.Untagged))?.text).toMatchInlineSnapshot(
            `"@sender:server: First message"`,
        );

        const secondMessage = mkMessage({
            user: "@sender:server",
            event: true,
            room: room.roomId,
            msg: "Second message",
        });
        await addEvent(store, room, secondMessage);

        expect((await store.getPreviewForRoom(room, DefaultTagID.Untagged))?.text).toMatchInlineSnapshot(
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

        expect((await store.getPreviewForRoom(room, DefaultTagID.Untagged))?.text).toMatchInlineSnapshot(
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

        expect((await store.getPreviewForRoom(room, DefaultTagID.Untagged))?.text).toMatchInlineSnapshot(
            `"@sender:server: Second Message Edit"`,
        );
    });

    it("should ignore edits to unknown events", async () => {
        await expect(store.getPreviewForRoom(room, DefaultTagID.DM)).resolves.toBeNull();

        const firstMessage = mkMessage({
            user: "@sender:server",
            event: true,
            room: room.roomId,
            msg: "First message",
        });
        await addEvent(store, room, firstMessage, true);

        expect((await store.getPreviewForRoom(room, DefaultTagID.DM))?.text).toMatchInlineSnapshot(
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

        expect((await store.getPreviewForRoom(room, DefaultTagID.Untagged))?.text).toMatchInlineSnapshot(
            `"@sender:server: First message"`,
        );
    });

    it("should generate correct preview for message events in DMs", async () => {
        room.getLiveTimeline().getState(EventTimeline.FORWARDS)!.getJoinedMemberCount = jest.fn().mockReturnValue(2);

        await expect(store.getPreviewForRoom(room, DefaultTagID.DM)).resolves.toBeNull();

        const firstMessage = mkMessage({
            user: "@sender:server",
            event: true,
            room: room.roomId,
            msg: "First message",
        });
        await addEvent(store, room, firstMessage);

        expect((await store.getPreviewForRoom(room, DefaultTagID.DM))?.text).toMatchInlineSnapshot(
            `"@sender:server: First message"`,
        );

        const secondMessage = mkMessage({
            user: "@sender:server",
            event: true,
            room: room.roomId,
            msg: "Second message",
        });
        await addEvent(store, room, secondMessage);

        expect((await store.getPreviewForRoom(room, DefaultTagID.DM))?.text).toMatchInlineSnapshot(
            `"@sender:server: Second message"`,
        );
    });

    it("should generate the correct preview for a reaction", async () => {
        const firstMessage = mkMessage({
            user: "@sender:server",
            event: true,
            room: room.roomId,
            msg: "First message",
        });
        await addEvent(store, room, firstMessage);

        const reaction = mkReaction(firstMessage);
        await addEvent(store, room, reaction);

        const preview = await store.getPreviewForRoom(room, DefaultTagID.Untagged);
        expect(preview).toBeDefined();
        expect(preview.isThreadReply).toBe(false);
        expect(preview.text).toMatchInlineSnapshot(`"@sender:server reacted 🙃 to First message"`);
    });

    it("should generate the correct preview for a reaction on a thread root", async () => {
        const { rootEvent, thread } = mkThread({
            room,
            client,
            authorId: client.getSafeUserId(),
            participantUserIds: [client.getSafeUserId()],
        });
        await addEvent(store, room, rootEvent);

        const reaction = mkReaction(rootEvent, { ts: 42 });
        reaction.setThread(thread);
        await addEvent(store, room, reaction);

        const preview = await store.getPreviewForRoom(room, DefaultTagID.Untagged);
        expect(preview).toBeDefined();
        expect(preview.isThreadReply).toBe(false);
        expect(preview.text).toContain("You reacted 🙃 to root event message");
    });
});
