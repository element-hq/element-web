/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Mocked, mocked } from "jest-mock";
import {
    EventStatus,
    EventTimeline,
    EventType,
    type MatrixClient,
    type MatrixEvent,
    PendingEventOrdering,
    RelationType,
    Room,
} from "matrix-js-sdk/src/matrix";

import { MessagePreviewStore } from "../../../../src/stores/room-list/MessagePreviewStore";
import { mkEvent, mkMessage, mkReaction, setupAsyncStoreWithClient, stubClient } from "../../../test-utils";
import { DefaultTagID } from "../../../../src/stores/room-list/models";
import { mkThread } from "../../../test-utils/threads";

describe("MessagePreviewStore", () => {
    let client: Mocked<MatrixClient>;
    let room: Room;
    let nonRenderedRoom: Room;
    let store: MessagePreviewStore;

    async function addEvent(
        store: MessagePreviewStore,
        room: Room,
        event: MatrixEvent,
        fireAction = true,
    ): Promise<void> {
        room.addLiveEvents([event], { addToState: true });
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

    async function addPendingEvent(
        store: MessagePreviewStore,
        room: Room,
        event: MatrixEvent,
        fireAction = true,
    ): Promise<void> {
        room.addPendingEvent(event, "txid");
        if (fireAction) {
            // @ts-ignore private access
            await store.onLocalEchoUpdated(event, room);
        }
    }

    async function updatePendingEvent(event: MatrixEvent, eventStatus: EventStatus, fireAction = true): Promise<void> {
        room.updatePendingEvent(event, eventStatus);
        if (fireAction) {
            // @ts-ignore private access
            await store.onLocalEchoUpdated(event, room);
        }
    }

    beforeEach(async () => {
        client = mocked(stubClient());
        room = new Room("!roomId:server", client, client.getSafeUserId(), {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        nonRenderedRoom = new Room("!roomId2:server", client, client.getSafeUserId(), {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
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

    it("should not display a redacted edit", async () => {
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

        secondMessage.makeRedacted(secondMessage, room);

        await addEvent(store, room, secondMessage);

        expect((await store.getPreviewForRoom(room, DefaultTagID.Untagged))?.text).toMatchInlineSnapshot(
            `"@sender:server: First message"`,
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
        expect(preview?.isThreadReply).toBe(false);
        expect(preview?.text).toMatchInlineSnapshot(`"@sender:server reacted 🙃 to First message"`);
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
        expect(preview?.isThreadReply).toBe(false);
        expect(preview?.text).toContain("You reacted 🙃 to root event message");
    });

    it("should handle local echos correctly", async () => {
        const firstMessage = mkMessage({
            user: "@sender:server",
            event: true,
            room: room.roomId,
            msg: "First message",
        });

        await addEvent(store, room, firstMessage);

        expect((await store.getPreviewForRoom(room, DefaultTagID.Untagged))?.text).toMatchInlineSnapshot(
            `"@sender:server: First message"`,
        );

        const secondMessage = mkMessage({
            user: "@sender:server",
            event: true,
            room: room.roomId,
            msg: "Second message",
        });
        secondMessage.status = EventStatus.NOT_SENT;

        await addPendingEvent(store, room, secondMessage);

        expect((await store.getPreviewForRoom(room, DefaultTagID.Untagged))?.text).toMatchInlineSnapshot(
            `"@sender:server: Second message"`,
        );

        await updatePendingEvent(secondMessage, EventStatus.CANCELLED);

        expect((await store.getPreviewForRoom(room, DefaultTagID.Untagged))?.text).toMatchInlineSnapshot(
            `"@sender:server: First message"`,
        );
    });

    it("should not generate previews for rooms not rendered", async () => {
        const firstMessage = mkMessage({
            user: "@sender:server",
            event: true,
            room: nonRenderedRoom.roomId,
            msg: "First message",
        });

        await addEvent(store, room, firstMessage);

        const secondMessage = mkMessage({
            user: "@sender:server",
            event: true,
            room: nonRenderedRoom.roomId,
            msg: "Second message",
        });
        secondMessage.status = EventStatus.NOT_SENT;

        await addPendingEvent(store, room, secondMessage);

        // @ts-ignore private access
        expect(store.previews.has(nonRenderedRoom.roomId)).toBeFalsy();
    });
});
