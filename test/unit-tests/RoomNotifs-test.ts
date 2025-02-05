/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import {
    PushRuleActionName,
    TweakName,
    NotificationCountType,
    Room,
    EventStatus,
    EventType,
    type MatrixEvent,
    PendingEventOrdering,
    type MatrixClient,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { mkEvent, mkRoom, mkRoomMember, muteRoom, stubClient, upsertRoomStateEvents } from "../test-utils";
import {
    getRoomNotifsState,
    RoomNotifState,
    getUnreadNotificationCount,
    determineUnreadState,
} from "../../src/RoomNotifs";
import { NotificationLevel } from "../../src/stores/notifications/NotificationLevel";
import SettingsStore from "../../src/settings/SettingsStore";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";

describe("RoomNotifs test", () => {
    let client: jest.Mocked<MatrixClient>;

    beforeEach(() => {
        client = stubClient() as jest.Mocked<MatrixClient>;
    });

    it("getRoomNotifsState handles rules with no conditions", () => {
        mocked(client).pushRules = {
            global: {
                override: [
                    {
                        rule_id: "!roomId:server",
                        enabled: true,
                        default: false,
                        actions: [],
                    },
                ],
            },
        };
        expect(getRoomNotifsState(client, "!roomId:server")).toBe(null);
    });

    it("getRoomNotifsState handles guest users", () => {
        mocked(client).isGuest.mockReturnValue(true);
        expect(getRoomNotifsState(client, "!roomId:server")).toBe(RoomNotifState.AllMessages);
    });

    it("getRoomNotifsState handles mute state", () => {
        const room = mkRoom(client, "!roomId:server");
        muteRoom(room);
        expect(getRoomNotifsState(client, room.roomId)).toBe(RoomNotifState.Mute);
    });

    it("getRoomNotifsState handles mute state for legacy DontNotify action", () => {
        const room = mkRoom(client, "!roomId:server");
        muteRoom(room);
        client.pushRules!.global.override![0]!.actions = [PushRuleActionName.DontNotify];
        expect(getRoomNotifsState(client, room.roomId)).toBe(RoomNotifState.Mute);
    });

    it("getRoomNotifsState handles mentions only", () => {
        (client as any).getRoomPushRule = () => ({
            rule_id: "!roomId:server",
            enabled: true,
            default: false,
            actions: [PushRuleActionName.DontNotify],
        });
        expect(getRoomNotifsState(client, "!roomId:server")).toBe(RoomNotifState.MentionsOnly);
    });

    it("getRoomNotifsState handles noisy", () => {
        (client as any).getRoomPushRule = () => ({
            rule_id: "!roomId:server",
            enabled: true,
            default: false,
            actions: [{ set_tweak: TweakName.Sound, value: "default" }],
        });
        expect(getRoomNotifsState(client, "!roomId:server")).toBe(RoomNotifState.AllMessagesLoud);
    });

    describe("getUnreadNotificationCount", () => {
        const ROOM_ID = "!roomId:example.org";
        const THREAD_ID = "$threadId";

        let room: Room;
        beforeEach(() => {
            room = new Room(ROOM_ID, client, client.getUserId()!);
        });

        it("counts room notification type", () => {
            expect(getUnreadNotificationCount(room, NotificationCountType.Total, false)).toBe(0);
            expect(getUnreadNotificationCount(room, NotificationCountType.Highlight, false)).toBe(0);
        });

        it("counts notifications type", () => {
            room.setUnreadNotificationCount(NotificationCountType.Total, 2);
            room.setUnreadNotificationCount(NotificationCountType.Highlight, 1);

            expect(getUnreadNotificationCount(room, NotificationCountType.Total, false)).toBe(2);
            expect(getUnreadNotificationCount(room, NotificationCountType.Highlight, false)).toBe(1);
        });

        describe("when there is a room predecessor", () => {
            const OLD_ROOM_ID = "!oldRoomId:example.org";
            const mkCreateEvent = (predecessorId?: string): MatrixEvent => {
                return mkEvent({
                    event: true,
                    type: "m.room.create",
                    room: ROOM_ID,
                    user: "@zoe:localhost",
                    content: {
                        ...(predecessorId ? { predecessor: { room_id: predecessorId, event_id: "$someevent" } } : {}),
                        creator: "@zoe:localhost",
                        room_version: "5",
                    },
                    ts: Date.now(),
                });
            };

            const mkPredecessorEvent = (predecessorId: string): MatrixEvent => {
                return mkEvent({
                    event: true,
                    type: EventType.RoomPredecessor,
                    room: ROOM_ID,
                    user: "@zoe:localhost",
                    skey: "",
                    content: {
                        predecessor_room_id: predecessorId,
                    },
                    ts: Date.now(),
                });
            };

            const itShouldCountPredecessorHighlightWhenThereIsAPredecessorInTheCreateEvent = (): void => {
                it("and there is a predecessor in the create event, it should count predecessor highlight", () => {
                    room.addLiveEvents([mkCreateEvent(OLD_ROOM_ID)], { addToState: true });

                    expect(getUnreadNotificationCount(room, NotificationCountType.Total, false)).toBe(8);
                    expect(getUnreadNotificationCount(room, NotificationCountType.Highlight, false)).toBe(7);
                });
            };

            const itShouldCountPredecessorHighlightWhenThereIsAPredecessorEvent = (): void => {
                it("and there is a predecessor event, it should count predecessor highlight", () => {
                    client.getVisibleRooms();
                    room.addLiveEvents([mkCreateEvent(OLD_ROOM_ID)], { addToState: true });
                    upsertRoomStateEvents(room, [mkPredecessorEvent(OLD_ROOM_ID)]);

                    expect(getUnreadNotificationCount(room, NotificationCountType.Total, false)).toBe(8);
                    expect(getUnreadNotificationCount(room, NotificationCountType.Highlight, false)).toBe(7);
                });
            };

            beforeEach(() => {
                room.setUnreadNotificationCount(NotificationCountType.Total, 2);
                room.setUnreadNotificationCount(NotificationCountType.Highlight, 1);

                const oldRoom = new Room(OLD_ROOM_ID, client, client.getUserId()!);
                oldRoom.setUnreadNotificationCount(NotificationCountType.Total, 10);
                oldRoom.setUnreadNotificationCount(NotificationCountType.Highlight, 6);

                client.getRoom.mockImplementation((roomId: string | undefined): Room | null => {
                    if (roomId === room.roomId) return room;
                    if (roomId === OLD_ROOM_ID) return oldRoom;
                    return null;
                });
            });

            describe("and dynamic room predecessors are disabled", () => {
                itShouldCountPredecessorHighlightWhenThereIsAPredecessorInTheCreateEvent();
                itShouldCountPredecessorHighlightWhenThereIsAPredecessorEvent();

                it("and there is only a predecessor event, it should not count predecessor highlight", () => {
                    room.addLiveEvents([mkCreateEvent()], { addToState: true });
                    upsertRoomStateEvents(room, [mkPredecessorEvent(OLD_ROOM_ID)]);

                    expect(getUnreadNotificationCount(room, NotificationCountType.Total, false)).toBe(2);
                    expect(getUnreadNotificationCount(room, NotificationCountType.Highlight, false)).toBe(1);
                });
            });

            describe("and dynamic room predecessors are enabled", () => {
                beforeEach(() => {
                    jest.spyOn(SettingsStore, "getValue").mockImplementation(
                        (settingName) => settingName === "feature_dynamic_room_predecessors",
                    );
                });

                itShouldCountPredecessorHighlightWhenThereIsAPredecessorInTheCreateEvent();
                itShouldCountPredecessorHighlightWhenThereIsAPredecessorEvent();

                it("and there is only a predecessor event, it should count predecessor highlight", () => {
                    room.addLiveEvents([mkCreateEvent()], { addToState: true });
                    upsertRoomStateEvents(room, [mkPredecessorEvent(OLD_ROOM_ID)]);

                    expect(getUnreadNotificationCount(room, NotificationCountType.Total, false)).toBe(8);
                    expect(getUnreadNotificationCount(room, NotificationCountType.Highlight, false)).toBe(7);
                });

                it("and there is an unknown room in the predecessor event, it should not count predecessor highlight", () => {
                    room.addLiveEvents([mkCreateEvent()], { addToState: true });
                    upsertRoomStateEvents(room, [mkPredecessorEvent("!unknon:example.com")]);

                    expect(getUnreadNotificationCount(room, NotificationCountType.Total, false)).toBe(2);
                    expect(getUnreadNotificationCount(room, NotificationCountType.Highlight, false)).toBe(1);
                });
            });
        });

        it("counts thread notification type", () => {
            expect(getUnreadNotificationCount(room, NotificationCountType.Total, false, THREAD_ID)).toBe(0);
            expect(getUnreadNotificationCount(room, NotificationCountType.Highlight, false, THREAD_ID)).toBe(0);
        });

        it("counts thread notifications type", () => {
            room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Total, 2);
            room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Highlight, 1);

            expect(getUnreadNotificationCount(room, NotificationCountType.Total, false, THREAD_ID)).toBe(2);
            expect(getUnreadNotificationCount(room, NotificationCountType.Highlight, false, THREAD_ID)).toBe(1);
        });
    });

    describe("determineUnreadState", () => {
        let room: Room;

        beforeEach(() => {
            room = new Room("!room-id:example.com", client, "@user:example.com", {
                pendingEventOrdering: PendingEventOrdering.Detached,
            });
        });

        it("shows nothing by default", async () => {
            const { level, symbol, count } = determineUnreadState(room);

            expect(symbol).toBe(null);
            expect(level).toBe(NotificationLevel.None);
            expect(count).toBe(0);
        });

        it("indicates if there are unsent messages", async () => {
            const event = mkEvent({
                event: true,
                type: "m.message",
                user: "@user:example.org",
                content: {},
            });
            event.status = EventStatus.NOT_SENT;
            room.addPendingEvent(event, "txn");

            const { level, symbol, count } = determineUnreadState(room);

            expect(symbol).toBe("!");
            expect(level).toBe(NotificationLevel.Unsent);
            expect(count).toBeGreaterThan(0);
        });

        it("indicates the user has been invited to a channel", async () => {
            room.updateMyMembership(KnownMembership.Invite);

            const { level, symbol, count } = determineUnreadState(room);

            expect(symbol).toBe("!");
            expect(level).toBe(NotificationLevel.Highlight);
            expect(count).toBeGreaterThan(0);
        });

        it("indicates the user knock has been denied", async () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((name) => {
                return name === "feature_ask_to_join";
            });
            const roomMember = mkRoomMember(
                room.roomId,
                MatrixClientPeg.get()!.getSafeUserId(),
                KnownMembership.Leave,
                true,
                {
                    membership: KnownMembership.Knock,
                },
            );
            jest.spyOn(room, "getMember").mockReturnValue(roomMember);
            const { level, symbol, count } = determineUnreadState(room);

            expect(symbol).toBe("!");
            expect(level).toBe(NotificationLevel.Highlight);
            expect(count).toBeGreaterThan(0);
        });

        it("shows nothing for muted channels", async () => {
            room.setUnreadNotificationCount(NotificationCountType.Highlight, 99);
            room.setUnreadNotificationCount(NotificationCountType.Total, 99);
            muteRoom(room);

            const { level, count } = determineUnreadState(room);

            expect(level).toBe(NotificationLevel.None);
            expect(count).toBe(0);
        });

        it("uses the correct number of unreads", async () => {
            room.setUnreadNotificationCount(NotificationCountType.Total, 999);

            const { level, count } = determineUnreadState(room);

            expect(level).toBe(NotificationLevel.Notification);
            expect(count).toBe(999);
        });

        it("uses the correct number of highlights", async () => {
            room.setUnreadNotificationCount(NotificationCountType.Highlight, 888);

            const { level, count } = determineUnreadState(room);

            expect(level).toBe(NotificationLevel.Highlight);
            expect(count).toBe(888);
        });
    });
});
