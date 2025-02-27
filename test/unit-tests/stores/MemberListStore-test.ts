/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { EventType, type IContent, type MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import SdkConfig from "../../../src/SdkConfig";
import SettingsStore from "../../../src/settings/SettingsStore";
import { MemberListStore } from "../../../src/stores/MemberListStore";
import { stubClient } from "../../test-utils";
import { TestSdkContext } from "../TestSdkContext";

describe("MemberListStore", () => {
    const alice = "@alice:bar";
    const bob = "@bob:bar";
    const charlie = "@charlie:bar";
    const roomId = "!foo:bar";
    let store: MemberListStore;
    let client: MatrixClient;
    let room: Room;

    beforeEach(() => {
        const context = new TestSdkContext();
        client = stubClient();
        client.baseUrl = "https://invalid.base.url.here";
        context.client = client;
        store = new MemberListStore(context);
        // alice is joined to the room.
        room = new Room(roomId, client, client.getUserId()!);
        room.currentState.setStateEvents([
            new MatrixEvent({
                type: EventType.RoomCreate,
                state_key: "",
                content: {
                    creator: alice,
                },
                sender: alice,
                room_id: roomId,
                event_id: "$1",
            }),
            new MatrixEvent({
                type: EventType.RoomMember,
                state_key: alice,
                content: {
                    membership: KnownMembership.Join,
                },
                sender: alice,
                room_id: roomId,
                event_id: "$2",
            }),
        ]);
        room.recalculate();
        mocked(client.getRoom).mockImplementation((r: string): Room | null => {
            if (r === roomId) {
                return room;
            }
            return null;
        });
        SdkConfig.put({
            enable_presence_by_hs_url: {
                [client.baseUrl]: false,
            },
        });
    });

    it("loads members in a room", async () => {
        addMember(room, bob, KnownMembership.Invite);
        addMember(room, charlie, KnownMembership.Leave);

        const { invited, joined } = await store.loadMemberList(roomId);
        expect(invited).toEqual([room.getMember(bob)]);
        expect(joined).toEqual([room.getMember(alice)]);
    });

    it("fails gracefully for invalid rooms", async () => {
        const { invited, joined } = await store.loadMemberList("!idontexist:bar");
        expect(invited).toEqual([]);
        expect(joined).toEqual([]);
    });

    it("sorts by power level", async () => {
        addMember(room, bob, KnownMembership.Join);
        addMember(room, charlie, KnownMembership.Join);
        setPowerLevels(room, {
            users: {
                [alice]: 100,
                [charlie]: 50,
            },
            users_default: 10,
        });

        const { invited, joined } = await store.loadMemberList(roomId);
        expect(invited).toEqual([]);
        expect(joined).toEqual([room.getMember(alice), room.getMember(charlie), room.getMember(bob)]);
    });

    it("sorts by name if power level is equal", async () => {
        const doris = "@doris:bar";
        addMember(room, bob, KnownMembership.Join);
        addMember(room, charlie, KnownMembership.Join);
        setPowerLevels(room, {
            users_default: 10,
        });

        let { invited, joined } = await store.loadMemberList(roomId);
        expect(invited).toEqual([]);
        expect(joined).toEqual([room.getMember(alice), room.getMember(bob), room.getMember(charlie)]);

        // Ensure it sorts by display name if they are set
        addMember(room, doris, KnownMembership.Join, "AAAAA");
        ({ invited, joined } = await store.loadMemberList(roomId));
        expect(invited).toEqual([]);
        expect(joined).toEqual([
            room.getMember(doris),
            room.getMember(alice),
            room.getMember(bob),
            room.getMember(charlie),
        ]);
    });

    it("filters based on a search query", async () => {
        const mice = "@mice:bar";
        const zorro = "@zorro:bar";
        addMember(room, bob, KnownMembership.Join);
        addMember(room, mice, KnownMembership.Join);

        let { invited, joined } = await store.loadMemberList(roomId, "ice");
        expect(invited).toEqual([]);
        expect(joined).toEqual([room.getMember(alice), room.getMember(mice)]);

        // Ensure it filters by display name if they are set
        addMember(room, zorro, KnownMembership.Join, "ice ice baby");
        ({ invited, joined } = await store.loadMemberList(roomId, "ice"));
        expect(invited).toEqual([]);
        expect(joined).toEqual([room.getMember(alice), room.getMember(zorro), room.getMember(mice)]);
    });

    describe("lazy loading", () => {
        beforeEach(() => {
            mocked(client.hasLazyLoadMembersEnabled).mockReturnValue(true);
            room.loadMembersIfNeeded = jest.fn();
            mocked(room.loadMembersIfNeeded).mockResolvedValue(true);
        });

        it("calls Room.loadMembersIfNeeded once when enabled", async () => {
            let { joined } = await store.loadMemberList(roomId);
            expect(joined).toEqual([room.getMember(alice)]);
            expect(room.loadMembersIfNeeded).toHaveBeenCalledTimes(1);
            ({ joined } = await store.loadMemberList(roomId));
            expect(joined).toEqual([room.getMember(alice)]);
            expect(room.loadMembersIfNeeded).toHaveBeenCalledTimes(1);
        });
    });

    describe("sliding sync", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName, roomId, value) => {
                return settingName === "feature_simplified_sliding_sync"; // this is enabled, everything else is disabled.
            });
            client.members = jest.fn();
        });

        it("calls /members when lazy loading", async () => {
            mocked(client.members).mockResolvedValue({
                chunk: [
                    {
                        type: EventType.RoomMember,
                        state_key: bob,
                        content: {
                            membership: KnownMembership.Join,
                            displayname: "Bob",
                        },
                        sender: bob,
                        room_id: room.roomId,
                        event_id: "$" + Math.random(),
                        origin_server_ts: 2,
                    },
                ],
            });
            const { joined } = await store.loadMemberList(roomId);
            expect(joined).toEqual([room.getMember(alice), room.getMember(bob)]);
            expect(client.members).toHaveBeenCalled();
        });

        it("does not use lazy loading on encrypted rooms", async () => {
            jest.spyOn(client.getCrypto()!, "isEncryptionEnabledInRoom").mockResolvedValue(true);

            const { joined } = await store.loadMemberList(roomId);
            expect(joined).toEqual([room.getMember(alice)]);
            expect(client.members).not.toHaveBeenCalled();
        });
    });
});

function addEventToRoom(room: Room, ev: MatrixEvent) {
    room.getLiveTimeline().addEvent(ev, {
        toStartOfTimeline: false,
        addToState: true,
    });
}

function setPowerLevels(room: Room, pl: IContent) {
    addEventToRoom(
        room,
        new MatrixEvent({
            type: EventType.RoomPowerLevels,
            state_key: "",
            content: pl,
            sender: room.getCreator()!,
            room_id: room.roomId,
            event_id: "$" + Math.random(),
        }),
    );
}

function addMember(room: Room, userId: string, membership: string, displayName?: string) {
    addEventToRoom(
        room,
        new MatrixEvent({
            type: EventType.RoomMember,
            state_key: userId,
            content: {
                membership: membership,
                displayname: displayName,
            },
            sender: userId,
            room_id: room.roomId,
            event_id: "$" + Math.random(),
        }),
    );
}
