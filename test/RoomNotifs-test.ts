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

import { mocked } from 'jest-mock';
import { ConditionKind, PushRuleActionName, TweakName } from "matrix-js-sdk/src/@types/PushRules";
import { NotificationCountType, Room } from 'matrix-js-sdk/src/models/room';

import { mkEvent, stubClient } from "./test-utils";
import { MatrixClientPeg } from "../src/MatrixClientPeg";
import {
    getRoomNotifsState,
    RoomNotifState,
    getUnreadNotificationCount,
} from "../src/RoomNotifs";

describe("RoomNotifs test", () => {
    beforeEach(() => {
        stubClient();
    });

    it("getRoomNotifsState handles rules with no conditions", () => {
        const cli = MatrixClientPeg.get();
        mocked(cli).pushRules = {
            global: {
                override: [{
                    rule_id: "!roomId:server",
                    enabled: true,
                    default: false,
                    actions: [],
                }],
            },
        };
        expect(getRoomNotifsState(cli, "!roomId:server")).toBe(null);
    });

    it("getRoomNotifsState handles guest users", () => {
        const cli = MatrixClientPeg.get();
        mocked(cli).isGuest.mockReturnValue(true);
        expect(getRoomNotifsState(cli, "!roomId:server")).toBe(RoomNotifState.AllMessages);
    });

    it("getRoomNotifsState handles mute state", () => {
        const cli = MatrixClientPeg.get();
        cli.pushRules = {
            global: {
                override: [{
                    rule_id: "!roomId:server",
                    enabled: true,
                    default: false,
                    conditions: [{
                        kind: ConditionKind.EventMatch,
                        key: "room_id",
                        pattern: "!roomId:server",
                    }],
                    actions: [PushRuleActionName.DontNotify],
                }],
            },
        };
        expect(getRoomNotifsState(cli, "!roomId:server")).toBe(RoomNotifState.Mute);
    });

    it("getRoomNotifsState handles mentions only", () => {
        const cli = MatrixClientPeg.get();
        cli.getRoomPushRule = () => ({
            rule_id: "!roomId:server",
            enabled: true,
            default: false,
            actions: [PushRuleActionName.DontNotify],
        });
        expect(getRoomNotifsState(cli, "!roomId:server")).toBe(RoomNotifState.MentionsOnly);
    });

    it("getRoomNotifsState handles noisy", () => {
        const cli = MatrixClientPeg.get();
        cli.getRoomPushRule = () => ({
            rule_id: "!roomId:server",
            enabled: true,
            default: false,
            actions: [{ set_tweak: TweakName.Sound, value: "default" }],
        });
        expect(getRoomNotifsState(cli, "!roomId:server")).toBe(RoomNotifState.AllMessagesLoud);
    });

    describe("getUnreadNotificationCount", () => {
        const ROOM_ID = "!roomId:example.org";
        const THREAD_ID = "$threadId";

        let cli;
        let room: Room;
        beforeEach(() => {
            cli = MatrixClientPeg.get();
            room = new Room(ROOM_ID, cli, cli.getUserId());
        });

        it("counts room notification type", () => {
            expect(getUnreadNotificationCount(room, NotificationCountType.Total)).toBe(0);
            expect(getUnreadNotificationCount(room, NotificationCountType.Highlight)).toBe(0);
        });

        it("counts notifications type", () => {
            room.setUnreadNotificationCount(NotificationCountType.Total, 2);
            room.setUnreadNotificationCount(NotificationCountType.Highlight, 1);

            expect(getUnreadNotificationCount(room, NotificationCountType.Total)).toBe(2);
            expect(getUnreadNotificationCount(room, NotificationCountType.Highlight)).toBe(1);
        });

        it("counts predecessor highlight", () => {
            room.setUnreadNotificationCount(NotificationCountType.Total, 2);
            room.setUnreadNotificationCount(NotificationCountType.Highlight, 1);

            const OLD_ROOM_ID = "!oldRoomId:example.org";
            const oldRoom = new Room(OLD_ROOM_ID, cli, cli.getUserId());
            oldRoom.setUnreadNotificationCount(NotificationCountType.Total, 10);
            oldRoom.setUnreadNotificationCount(NotificationCountType.Highlight, 6);

            cli.getRoom.mockReset().mockReturnValue(oldRoom);

            const predecessorEvent = mkEvent({
                event: true,
                type: "m.room.create",
                room: ROOM_ID,
                user: cli.getUserId(),
                content: {
                    creator: cli.getUserId(),
                    room_version: "5",
                    predecessor: {
                        room_id: OLD_ROOM_ID,
                        event_id: "$someevent",
                    },
                },
                ts: Date.now(),
            });
            room.addLiveEvents([predecessorEvent]);

            expect(getUnreadNotificationCount(room, NotificationCountType.Total)).toBe(8);
            expect(getUnreadNotificationCount(room, NotificationCountType.Highlight)).toBe(7);
        });

        it("counts thread notification type", () => {
            expect(getUnreadNotificationCount(room, NotificationCountType.Total, THREAD_ID)).toBe(0);
            expect(getUnreadNotificationCount(room, NotificationCountType.Highlight, THREAD_ID)).toBe(0);
        });

        it("counts notifications type", () => {
            room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Total, 2);
            room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Highlight, 1);

            expect(getUnreadNotificationCount(room, NotificationCountType.Total, THREAD_ID)).toBe(2);
            expect(getUnreadNotificationCount(room, NotificationCountType.Highlight, THREAD_ID)).toBe(1);
        });
    });
});
