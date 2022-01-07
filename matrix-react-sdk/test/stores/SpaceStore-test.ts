/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { EventType } from "matrix-js-sdk/src/@types/event";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

import "./enable-metaspaces-labs";
import "../skinned-sdk"; // Must be first for skinning to work
import SpaceStore from "../../src/stores/spaces/SpaceStore";
import {
    MetaSpace,
    UPDATE_HOME_BEHAVIOUR,
    UPDATE_INVITED_SPACES,
    UPDATE_SELECTED_SPACE,
    UPDATE_TOP_LEVEL_SPACES,
} from "../../src/stores/spaces";
import * as testUtils from "../utils/test-utils";
import { mkEvent, stubClient } from "../test-utils";
import DMRoomMap from "../../src/utils/DMRoomMap";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import defaultDispatcher from "../../src/dispatcher/dispatcher";
import SettingsStore from "../../src/settings/SettingsStore";
import { SettingLevel } from "../../src/settings/SettingLevel";

jest.useFakeTimers();

const testUserId = "@test:user";

const fav1 = "!fav1:server";
const fav2 = "!fav2:server";
const fav3 = "!fav3:server";
const dm1 = "!dm1:server";
const dm1Partner = new RoomMember(dm1, "@dm1Partner:server");
dm1Partner.membership = "join";
const dm2 = "!dm2:server";
const dm2Partner = new RoomMember(dm2, "@dm2Partner:server");
dm2Partner.membership = "join";
const dm3 = "!dm3:server";
const dm3Partner = new RoomMember(dm3, "@dm3Partner:server");
dm3Partner.membership = "join";
const orphan1 = "!orphan1:server";
const orphan2 = "!orphan2:server";
const invite1 = "!invite1:server";
const invite2 = "!invite2:server";
const room1 = "!room1:server";
const room2 = "!room2:server";
const room3 = "!room3:server";
const space1 = "!space1:server";
const space2 = "!space2:server";
const space3 = "!space3:server";

const getUserIdForRoomId = jest.fn(roomId => {
    return {
        [dm1]: dm1Partner.userId,
        [dm2]: dm2Partner.userId,
        [dm3]: dm3Partner.userId,
    }[roomId];
});
const getDMRoomsForUserId = jest.fn(userId => {
    switch (userId) {
        case dm1Partner.userId:
            return [dm1];
        case dm2Partner.userId:
            return [dm2];
        case dm3Partner.userId:
            return [dm3];
        default:
            return [];
    }
});
// @ts-ignore
DMRoomMap.sharedInstance = { getUserIdForRoomId, getDMRoomsForUserId };

describe("SpaceStore", () => {
    stubClient();
    const store = SpaceStore.instance;
    const client = MatrixClientPeg.get();

    let rooms = [];
    const mkRoom = (roomId: string) => testUtils.mkRoom(client, roomId, rooms);
    const mkSpace = (spaceId: string, children: string[] = []) => testUtils.mkSpace(client, spaceId, rooms, children);
    const viewRoom = roomId => defaultDispatcher.dispatch({ action: "view_room", room_id: roomId }, true);

    const run = async () => {
        client.getRoom.mockImplementation(roomId => rooms.find(room => room.roomId === roomId));
        client.getRoomUpgradeHistory.mockImplementation(roomId => [rooms.find(room => room.roomId === roomId)]);
        await testUtils.setupAsyncStoreWithClient(store, client);
        jest.runAllTimers();
    };

    const setShowAllRooms = async (value: boolean) => {
        if (store.allRoomsInHome === value) return;
        const emitProm = testUtils.emitPromise(store, UPDATE_HOME_BEHAVIOUR);
        await SettingsStore.setValue("Spaces.allRoomsInHome", null, SettingLevel.DEVICE, value);
        jest.runAllTimers(); // run async dispatch
        await emitProm;
    };

    beforeEach(async () => {
        jest.runAllTimers(); // run async dispatch
        client.getVisibleRooms.mockReturnValue(rooms = []);

        await SettingsStore.setValue("Spaces.enabledMetaSpaces", null, SettingLevel.DEVICE, {
            [MetaSpace.Home]: true,
            [MetaSpace.Favourites]: true,
            [MetaSpace.People]: true,
            [MetaSpace.Orphans]: true,
        });
    });

    afterEach(async () => {
        await testUtils.resetAsyncStoreWithClient(store);
    });

    describe("static hierarchy resolution tests", () => {
        it("handles no spaces", async () => {
            await run();

            expect(store.spacePanelSpaces).toStrictEqual([]);
            expect(store.invitedSpaces).toStrictEqual([]);
        });

        it("handles 3 joined top level spaces", async () => {
            mkSpace("!space1:server");
            mkSpace("!space2:server");
            mkSpace("!space3:server");
            await run();

            expect(store.spacePanelSpaces.sort()).toStrictEqual(client.getVisibleRooms().sort());
            expect(store.invitedSpaces).toStrictEqual([]);
        });

        it("handles a basic hierarchy", async () => {
            mkSpace("!space1:server");
            mkSpace("!space2:server");
            mkSpace("!company:server", [
                mkSpace("!company_dept1:server", [
                    mkSpace("!company_dept1_group1:server").roomId,
                ]).roomId,
                mkSpace("!company_dept2:server").roomId,
            ]);
            await run();

            expect(store.spacePanelSpaces.map(r => r.roomId).sort()).toStrictEqual([
                "!space1:server",
                "!space2:server",
                "!company:server",
            ].sort());
            expect(store.invitedSpaces).toStrictEqual([]);

            expect(store.getChildRooms("!space1:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!space1:server")).toStrictEqual([]);
            expect(store.getChildRooms("!space2:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!space2:server")).toStrictEqual([]);
            expect(store.getChildRooms("!company:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!company:server")).toStrictEqual([
                client.getRoom("!company_dept1:server"),
                client.getRoom("!company_dept2:server"),
            ]);
            expect(store.getChildRooms("!company_dept1:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!company_dept1:server")).toStrictEqual([
                client.getRoom("!company_dept1_group1:server"),
            ]);
            expect(store.getChildRooms("!company_dept1_group1:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!company_dept1_group1:server")).toStrictEqual([]);
            expect(store.getChildRooms("!company_dept2:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!company_dept2:server")).toStrictEqual([]);
        });

        it("handles a sub-space existing in multiple places in the space tree", async () => {
            const subspace = mkSpace("!subspace:server");
            mkSpace("!space1:server");
            mkSpace("!space2:server");
            mkSpace("!company:server", [
                mkSpace("!company_dept1:server", [
                    mkSpace("!company_dept1_group1:server", [subspace.roomId]).roomId,
                ]).roomId,
                mkSpace("!company_dept2:server", [subspace.roomId]).roomId,
                subspace.roomId,
            ]);
            await run();

            expect(store.spacePanelSpaces.map(r => r.roomId).sort()).toStrictEqual([
                "!space1:server",
                "!space2:server",
                "!company:server",
            ].sort());
            expect(store.invitedSpaces).toStrictEqual([]);

            expect(store.getChildRooms("!space1:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!space1:server")).toStrictEqual([]);
            expect(store.getChildRooms("!space2:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!space2:server")).toStrictEqual([]);
            expect(store.getChildRooms("!company:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!company:server")).toStrictEqual([
                client.getRoom("!company_dept1:server"),
                client.getRoom("!company_dept2:server"),
                subspace,
            ]);
            expect(store.getChildRooms("!company_dept1:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!company_dept1:server")).toStrictEqual([
                client.getRoom("!company_dept1_group1:server"),
            ]);
            expect(store.getChildRooms("!company_dept1_group1:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!company_dept1_group1:server")).toStrictEqual([subspace]);
            expect(store.getChildRooms("!company_dept2:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!company_dept2:server")).toStrictEqual([subspace]);
        });

        it("handles full cycles", async () => {
            mkSpace("!a:server", [
                mkSpace("!b:server", [
                    mkSpace("!c:server", [
                        "!a:server",
                    ]).roomId,
                ]).roomId,
            ]);
            await run();

            expect(store.spacePanelSpaces.map(r => r.roomId)).toStrictEqual(["!a:server"]);
            expect(store.invitedSpaces).toStrictEqual([]);

            expect(store.getChildRooms("!a:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!a:server")).toStrictEqual([client.getRoom("!b:server")]);
            expect(store.getChildRooms("!b:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!b:server")).toStrictEqual([client.getRoom("!c:server")]);
            expect(store.getChildRooms("!c:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!c:server")).toStrictEqual([client.getRoom("!a:server")]);
        });

        it("handles partial cycles", async () => {
            mkSpace("!b:server", [
                mkSpace("!a:server", [
                    mkSpace("!c:server", [
                        "!a:server",
                    ]).roomId,
                ]).roomId,
            ]);
            await run();

            expect(store.spacePanelSpaces.map(r => r.roomId)).toStrictEqual(["!b:server"]);
            expect(store.invitedSpaces).toStrictEqual([]);

            expect(store.getChildRooms("!b:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!b:server")).toStrictEqual([client.getRoom("!a:server")]);
            expect(store.getChildRooms("!a:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!a:server")).toStrictEqual([client.getRoom("!c:server")]);
            expect(store.getChildRooms("!c:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!c:server")).toStrictEqual([client.getRoom("!a:server")]);
        });

        it("handles partial cycles with additional spaces coming off them", async () => {
            // TODO this test should be failing right now
            mkSpace("!a:server", [
                mkSpace("!b:server", [
                    mkSpace("!c:server", [
                        "!a:server",
                        mkSpace("!d:server").roomId,
                    ]).roomId,
                ]).roomId,
            ]);
            await run();

            expect(store.spacePanelSpaces.map(r => r.roomId)).toStrictEqual(["!a:server"]);
            expect(store.invitedSpaces).toStrictEqual([]);

            expect(store.getChildRooms("!a:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!a:server")).toStrictEqual([client.getRoom("!b:server")]);
            expect(store.getChildRooms("!b:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!b:server")).toStrictEqual([client.getRoom("!c:server")]);
            expect(store.getChildRooms("!c:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!c:server")).toStrictEqual([
                client.getRoom("!a:server"),
                client.getRoom("!d:server"),
            ]);
            expect(store.getChildRooms("!d:server")).toStrictEqual([]);
            expect(store.getChildSpaces("!d:server")).toStrictEqual([]);
        });

        it("invite to a subspace is only shown at the top level", async () => {
            mkSpace(invite1).getMyMembership.mockReturnValue("invite");
            mkSpace(space1, [invite1]);
            await run();

            expect(store.spacePanelSpaces).toStrictEqual([client.getRoom(space1)]);
            expect(store.getChildSpaces(space1)).toStrictEqual([]);
            expect(store.getChildRooms(space1)).toStrictEqual([]);
            expect(store.invitedSpaces).toStrictEqual([client.getRoom(invite1)]);
        });

        describe("test fixture 1", () => {
            beforeEach(async () => {
                [fav1, fav2, fav3, dm1, dm2, dm3, orphan1, orphan2, invite1, invite2, room1, room2, room3]
                    .forEach(mkRoom);
                mkSpace(space1, [fav1, room1]);
                mkSpace(space2, [fav1, fav2, fav3, room1]);
                mkSpace(space3, [invite2]);
                client.getRoom.mockImplementation(roomId => rooms.find(room => room.roomId === roomId));

                [fav1, fav2, fav3].forEach(roomId => {
                    client.getRoom(roomId).tags = {
                        "m.favourite": {
                            order: 0.5,
                        },
                    };
                });

                [invite1, invite2].forEach(roomId => {
                    client.getRoom(roomId).getMyMembership.mockReturnValue("invite");
                });

                // have dmPartner1 be in space1 with you
                const mySpace1Member = new RoomMember(space1, testUserId);
                mySpace1Member.membership = "join";
                (rooms.find(r => r.roomId === space1).getMembers as jest.Mock).mockReturnValue([
                    mySpace1Member,
                    dm1Partner,
                ]);
                // have dmPartner2 be in space2 with you
                const mySpace2Member = new RoomMember(space2, testUserId);
                mySpace2Member.membership = "join";
                (rooms.find(r => r.roomId === space2).getMembers as jest.Mock).mockReturnValue([
                    mySpace2Member,
                    dm2Partner,
                ]);
                // dmPartner3 is not in any common spaces with you

                // room 2 claims to be a child of space2 and is so via a valid m.space.parent
                const cliRoom2 = client.getRoom(room2);
                cliRoom2.currentState.getStateEvents.mockImplementation(testUtils.mockStateEventImplementation([
                    mkEvent({
                        event: true,
                        type: EventType.SpaceParent,
                        room: room2,
                        user: client.getUserId(),
                        skey: space2,
                        content: { via: [], canonical: true },
                        ts: Date.now(),
                    }),
                ]));
                const cliSpace2 = client.getRoom(space2);
                cliSpace2.currentState.maySendStateEvent.mockImplementation((evType: string, userId: string) => {
                    if (evType === EventType.SpaceChild) {
                        return userId === client.getUserId();
                    }
                    return true;
                });

                // room 3 claims to be a child of space3 but is not due to invalid m.space.parent (permissions)
                const cliRoom3 = client.getRoom(room3);
                cliRoom3.currentState.getStateEvents.mockImplementation(testUtils.mockStateEventImplementation([
                    mkEvent({
                        event: true,
                        type: EventType.SpaceParent,
                        room: room3,
                        user: client.getUserId(),
                        skey: space3,
                        content: { via: [], canonical: true },
                        ts: Date.now(),
                    }),
                ]));
                const cliSpace3 = client.getRoom(space3);
                cliSpace3.currentState.maySendStateEvent.mockImplementation((evType: string, userId: string) => {
                    if (evType === EventType.SpaceChild) {
                        return false;
                    }
                    return true;
                });

                await run();
            });

            it("home space contains orphaned rooms", () => {
                expect(store.isRoomInSpace(MetaSpace.Home, orphan1)).toBeTruthy();
                expect(store.isRoomInSpace(MetaSpace.Home, orphan2)).toBeTruthy();
            });

            it("home space does not contain all favourites", () => {
                expect(store.isRoomInSpace(MetaSpace.Home, fav1)).toBeFalsy();
                expect(store.isRoomInSpace(MetaSpace.Home, fav2)).toBeFalsy();
                expect(store.isRoomInSpace(MetaSpace.Home, fav3)).toBeFalsy();
            });

            it("home space contains dm rooms", () => {
                expect(store.isRoomInSpace(MetaSpace.Home, dm1)).toBeTruthy();
                expect(store.isRoomInSpace(MetaSpace.Home, dm2)).toBeTruthy();
                expect(store.isRoomInSpace(MetaSpace.Home, dm3)).toBeTruthy();
            });

            it("home space contains invites", () => {
                expect(store.isRoomInSpace(MetaSpace.Home, invite1)).toBeTruthy();
            });

            it("home space contains invites even if they are also shown in a space", () => {
                expect(store.isRoomInSpace(MetaSpace.Home, invite2)).toBeTruthy();
            });

            it("all rooms space does contain rooms/low priority even if they are also shown in a space", async () => {
                await setShowAllRooms(true);
                expect(store.isRoomInSpace(MetaSpace.Home, room1)).toBeTruthy();
            });

            it("favourites space does contain favourites even if they are also shown in a space", async () => {
                expect(store.isRoomInSpace(MetaSpace.Favourites, fav1)).toBeTruthy();
                expect(store.isRoomInSpace(MetaSpace.Favourites, fav2)).toBeTruthy();
                expect(store.isRoomInSpace(MetaSpace.Favourites, fav3)).toBeTruthy();
            });

            it("people space does contain people even if they are also shown in a space", async () => {
                expect(store.isRoomInSpace(MetaSpace.People, dm1)).toBeTruthy();
                expect(store.isRoomInSpace(MetaSpace.People, dm2)).toBeTruthy();
                expect(store.isRoomInSpace(MetaSpace.People, dm3)).toBeTruthy();
            });

            it("orphans space does contain orphans even if they are also shown in all rooms", async () => {
                await setShowAllRooms(true);
                expect(store.isRoomInSpace(MetaSpace.Orphans, orphan1)).toBeTruthy();
                expect(store.isRoomInSpace(MetaSpace.Orphans, orphan2)).toBeTruthy();
            });

            it("home space doesn't contain rooms/low priority if they are also shown in a space", async () => {
                await setShowAllRooms(false);
                expect(store.isRoomInSpace(MetaSpace.Home, room1)).toBeFalsy();
            });

            it("space contains child rooms", () => {
                expect(store.isRoomInSpace(space1, fav1)).toBeTruthy();
                expect(store.isRoomInSpace(space1, room1)).toBeTruthy();
            });

            it("space contains child favourites", () => {
                expect(store.isRoomInSpace(space2, fav1)).toBeTruthy();
                expect(store.isRoomInSpace(space2, fav2)).toBeTruthy();
                expect(store.isRoomInSpace(space2, fav3)).toBeTruthy();
                expect(store.isRoomInSpace(space2, room1)).toBeTruthy();
            });

            it("space contains child invites", () => {
                expect(store.isRoomInSpace(space3, invite2)).toBeTruthy();
            });

            it("spaces contain dms which you have with members of that space", () => {
                expect(store.isRoomInSpace(space1, dm1)).toBeTruthy();
                expect(store.isRoomInSpace(space2, dm1)).toBeFalsy();
                expect(store.isRoomInSpace(space3, dm1)).toBeFalsy();
                expect(store.isRoomInSpace(space1, dm2)).toBeFalsy();
                expect(store.isRoomInSpace(space2, dm2)).toBeTruthy();
                expect(store.isRoomInSpace(space3, dm2)).toBeFalsy();
                expect(store.isRoomInSpace(space1, dm3)).toBeFalsy();
                expect(store.isRoomInSpace(space2, dm3)).toBeFalsy();
                expect(store.isRoomInSpace(space3, dm3)).toBeFalsy();
            });

            it("dms are only added to Notification States for only the People Space", async () => {
                [dm1, dm2, dm3].forEach(d => {
                    expect(store.getNotificationState(MetaSpace.People)
                        .rooms.map(r => r.roomId).includes(d)).toBeTruthy();
                });
                [space1, space2, space3, MetaSpace.Home, MetaSpace.Orphans, MetaSpace.Favourites].forEach(s => {
                    [dm1, dm2, dm3].forEach(d => {
                        expect(store.getNotificationState(s).rooms.map(r => r.roomId).includes(d)).toBeFalsy();
                    });
                });
            });

            it("orphan rooms are added to Notification States for only the Home Space", async () => {
                await setShowAllRooms(false);
                [orphan1, orphan2].forEach(d => {
                    expect(store.getNotificationState(MetaSpace.Home)
                        .rooms.map(r => r.roomId).includes(d)).toBeTruthy();
                });
                [space1, space2, space3].forEach(s => {
                    [orphan1, orphan2].forEach(d => {
                        expect(store.getNotificationState(s).rooms.map(r => r.roomId).includes(d)).toBeFalsy();
                    });
                });
            });

            it("favourites are added to Notification States for all spaces containing the room inc Home", () => {
                // XXX: All rooms space is forcibly enabled, as part of a future PR test Home space better
                // [fav1, fav2, fav3].forEach(d => {
                //     expect(store.getNotificationState(HOME_SPACE).rooms.map(r => r.roomId).includes(d)).toBeTruthy();
                // });
                expect(store.getNotificationState(space1).rooms.map(r => r.roomId).includes(fav1)).toBeTruthy();
                expect(store.getNotificationState(space1).rooms.map(r => r.roomId).includes(fav2)).toBeFalsy();
                expect(store.getNotificationState(space1).rooms.map(r => r.roomId).includes(fav3)).toBeFalsy();
                expect(store.getNotificationState(space2).rooms.map(r => r.roomId).includes(fav1)).toBeTruthy();
                expect(store.getNotificationState(space2).rooms.map(r => r.roomId).includes(fav2)).toBeTruthy();
                expect(store.getNotificationState(space2).rooms.map(r => r.roomId).includes(fav3)).toBeTruthy();
                expect(store.getNotificationState(space3).rooms.map(r => r.roomId).includes(fav1)).toBeFalsy();
                expect(store.getNotificationState(space3).rooms.map(r => r.roomId).includes(fav2)).toBeFalsy();
                expect(store.getNotificationState(space3).rooms.map(r => r.roomId).includes(fav3)).toBeFalsy();
            });

            it("other rooms are added to Notification States for all spaces containing the room exc Home", () => {
                // XXX: All rooms space is forcibly enabled, as part of a future PR test Home space better
                // expect(store.getNotificationState(HOME_SPACE).rooms.map(r => r.roomId).includes(room1)).toBeFalsy();
                expect(store.getNotificationState(space1).rooms.map(r => r.roomId).includes(room1)).toBeTruthy();
                expect(store.getNotificationState(space2).rooms.map(r => r.roomId).includes(room1)).toBeTruthy();
                expect(store.getNotificationState(space3).rooms.map(r => r.roomId).includes(room1)).toBeFalsy();
            });

            it("honours m.space.parent if sender has permission in parent space", () => {
                expect(store.isRoomInSpace(space2, room2)).toBeTruthy();
            });

            it("does not honour m.space.parent if sender does not have permission in parent space", () => {
                expect(store.isRoomInSpace(space3, room3)).toBeFalsy();
            });
        });
    });

    describe("hierarchy resolution update tests", () => {
        it("updates state when spaces are joined", async () => {
            await run();
            expect(store.spacePanelSpaces).toStrictEqual([]);
            const space = mkSpace(space1);
            const prom = testUtils.emitPromise(store, UPDATE_TOP_LEVEL_SPACES);
            client.emit("Room", space);
            await prom;
            expect(store.spacePanelSpaces).toStrictEqual([space]);
            expect(store.invitedSpaces).toStrictEqual([]);
        });

        it("updates state when spaces are left", async () => {
            const space = mkSpace(space1);
            await run();

            expect(store.spacePanelSpaces).toStrictEqual([space]);
            space.getMyMembership.mockReturnValue("leave");
            const prom = testUtils.emitPromise(store, UPDATE_TOP_LEVEL_SPACES);
            client.emit("Room.myMembership", space, "leave", "join");
            await prom;
            expect(store.spacePanelSpaces).toStrictEqual([]);
        });

        it("updates state when space invite comes in", async () => {
            await run();
            expect(store.spacePanelSpaces).toStrictEqual([]);
            expect(store.invitedSpaces).toStrictEqual([]);
            const space = mkSpace(space1);
            space.getMyMembership.mockReturnValue("invite");
            const prom = testUtils.emitPromise(store, UPDATE_INVITED_SPACES);
            client.emit("Room", space);
            await prom;
            expect(store.spacePanelSpaces).toStrictEqual([]);
            expect(store.invitedSpaces).toStrictEqual([space]);
        });

        it("updates state when space invite is accepted", async () => {
            const space = mkSpace(space1);
            space.getMyMembership.mockReturnValue("invite");
            await run();

            expect(store.spacePanelSpaces).toStrictEqual([]);
            expect(store.invitedSpaces).toStrictEqual([space]);
            space.getMyMembership.mockReturnValue("join");
            const prom = testUtils.emitPromise(store, UPDATE_TOP_LEVEL_SPACES);
            client.emit("Room.myMembership", space, "join", "invite");
            await prom;
            expect(store.spacePanelSpaces).toStrictEqual([space]);
            expect(store.invitedSpaces).toStrictEqual([]);
        });

        it("updates state when space invite is rejected", async () => {
            const space = mkSpace(space1);
            space.getMyMembership.mockReturnValue("invite");
            await run();

            expect(store.spacePanelSpaces).toStrictEqual([]);
            expect(store.invitedSpaces).toStrictEqual([space]);
            space.getMyMembership.mockReturnValue("leave");
            const prom = testUtils.emitPromise(store, UPDATE_INVITED_SPACES);
            client.emit("Room.myMembership", space, "leave", "invite");
            await prom;
            expect(store.spacePanelSpaces).toStrictEqual([]);
            expect(store.invitedSpaces).toStrictEqual([]);
        });

        it("room invite gets added to relevant space filters", async () => {
            const space = mkSpace(space1, [invite1]);
            await run();

            expect(store.spacePanelSpaces).toStrictEqual([space]);
            expect(store.invitedSpaces).toStrictEqual([]);
            expect(store.getChildSpaces(space1)).toStrictEqual([]);
            expect(store.getChildRooms(space1)).toStrictEqual([]);
            expect(store.isRoomInSpace(space1, invite1)).toBeFalsy();
            expect(store.isRoomInSpace(MetaSpace.Home, invite1)).toBeFalsy();

            const invite = mkRoom(invite1);
            invite.getMyMembership.mockReturnValue("invite");
            const prom = testUtils.emitPromise(store, space1);
            client.emit("Room", space);
            await prom;

            expect(store.spacePanelSpaces).toStrictEqual([space]);
            expect(store.invitedSpaces).toStrictEqual([]);
            expect(store.getChildSpaces(space1)).toStrictEqual([]);
            expect(store.getChildRooms(space1)).toStrictEqual([invite]);
            expect(store.isRoomInSpace(space1, invite1)).toBeTruthy();
            expect(store.isRoomInSpace(MetaSpace.Home, invite1)).toBeTruthy();
        });
    });

    describe("active space switching tests", () => {
        const fn = jest.spyOn(store, "emit");

        beforeEach(async () => {
            mkRoom(room1); // not a space
            mkSpace(space1, [
                mkSpace(space2).roomId,
            ]);
            mkSpace(space3).getMyMembership.mockReturnValue("invite");
            await run();
            store.setActiveSpace(MetaSpace.Home);
            expect(store.activeSpace).toBe(MetaSpace.Home);
        });
        afterEach(() => {
            fn.mockClear();
        });

        it("switch to home space", async () => {
            store.setActiveSpace(space1);
            fn.mockClear();

            store.setActiveSpace(MetaSpace.Home);
            expect(fn).toHaveBeenCalledWith(UPDATE_SELECTED_SPACE, MetaSpace.Home);
            expect(store.activeSpace).toBe(MetaSpace.Home);
        });

        it("switch to invited space", async () => {
            store.setActiveSpace(space3);
            expect(fn).toHaveBeenCalledWith(UPDATE_SELECTED_SPACE, space3);
            expect(store.activeSpace).toBe(space3);
        });

        it("switch to top level space", async () => {
            store.setActiveSpace(space1);
            expect(fn).toHaveBeenCalledWith(UPDATE_SELECTED_SPACE, space1);
            expect(store.activeSpace).toBe(space1);
        });

        it("switch to subspace", async () => {
            store.setActiveSpace(space2);
            expect(fn).toHaveBeenCalledWith(UPDATE_SELECTED_SPACE, space2);
            expect(store.activeSpace).toBe(space2);
        });

        it("switch to unknown space is a nop", async () => {
            expect(store.activeSpace).toBe(MetaSpace.Home);
            const space = client.getRoom(room1); // not a space
            store.setActiveSpace(space.roomId);
            expect(fn).not.toHaveBeenCalledWith(UPDATE_SELECTED_SPACE, space.roomId);
            expect(store.activeSpace).toBe(MetaSpace.Home);
        });
    });

    describe("context switching tests", () => {
        let dispatcherRef;
        let currentRoom = null;

        beforeEach(async () => {
            [room1, room2, orphan1].forEach(mkRoom);
            mkSpace(space1, [room1, room2]);
            mkSpace(space2, [room2]);
            await run();

            dispatcherRef = defaultDispatcher.register(payload => {
                if (payload.action === "view_room" || payload.action === "view_home_page") {
                    currentRoom = payload.room_id || null;
                }
            });
        });
        afterEach(() => {
            localStorage.clear();
            localStorage.setItem("mx_labs_feature_feature_spaces_metaspaces", "true");
            defaultDispatcher.unregister(dispatcherRef);
        });

        const getCurrentRoom = () => {
            jest.runAllTimers();
            return currentRoom;
        };

        it("last viewed room in target space is the current viewed and in both spaces", async () => {
            store.setActiveSpace(space1);
            viewRoom(room2);
            store.setActiveSpace(space2);
            viewRoom(room2);
            store.setActiveSpace(space1);
            expect(getCurrentRoom()).toBe(room2);
        });

        it("last viewed room in target space is in the current space", async () => {
            store.setActiveSpace(space1);
            viewRoom(room2);
            store.setActiveSpace(space2);
            expect(getCurrentRoom()).toBe(space2);
            store.setActiveSpace(space1);
            expect(getCurrentRoom()).toBe(room2);
        });

        it("last viewed room in target space is not in the current space", async () => {
            store.setActiveSpace(space1);
            viewRoom(room1);
            store.setActiveSpace(space2);
            viewRoom(room2);
            store.setActiveSpace(space1);
            expect(getCurrentRoom()).toBe(room1);
        });

        it("last viewed room is target space is not known", async () => {
            store.setActiveSpace(space1);
            viewRoom(room1);
            localStorage.setItem(`mx_space_context_${space2}`, orphan2);
            store.setActiveSpace(space2);
            expect(getCurrentRoom()).toBe(space2);
        });

        it("last viewed room is target space is no longer in that space", async () => {
            store.setActiveSpace(space1);
            viewRoom(room1);
            localStorage.setItem(`mx_space_context_${space2}`, room1);
            store.setActiveSpace(space2);
            expect(getCurrentRoom()).toBe(space2); // Space home instead of room1
        });

        it("no last viewed room in target space", async () => {
            store.setActiveSpace(space1);
            viewRoom(room1);
            store.setActiveSpace(space2);
            expect(getCurrentRoom()).toBe(space2);
        });

        it("no last viewed room in home space", async () => {
            store.setActiveSpace(space1);
            viewRoom(room1);
            store.setActiveSpace(MetaSpace.Home);
            expect(getCurrentRoom()).toBeNull(); // Home
        });
    });

    describe("space auto switching tests", () => {
        beforeEach(async () => {
            [room1, room2, room3, orphan1].forEach(mkRoom);
            mkSpace(space1, [room1, room2, room3]);
            mkSpace(space2, [room1, room2]);

            const cliRoom2 = client.getRoom(room2);
            cliRoom2.currentState.getStateEvents.mockImplementation(testUtils.mockStateEventImplementation([
                mkEvent({
                    event: true,
                    type: EventType.SpaceParent,
                    room: room2,
                    user: testUserId,
                    skey: space2,
                    content: { via: [], canonical: true },
                    ts: Date.now(),
                }),
            ]));
            await run();
        });

        it("no switch required, room is in current space", async () => {
            viewRoom(room1);
            store.setActiveSpace(space1, false);
            viewRoom(room2);
            expect(store.activeSpace).toBe(space1);
        });

        it("switch to canonical parent space for room", async () => {
            viewRoom(room1);
            store.setActiveSpace(space2, false);
            viewRoom(room2);
            expect(store.activeSpace).toBe(space2);
        });

        it("switch to first containing space for room", async () => {
            viewRoom(room2);
            store.setActiveSpace(space2, false);
            viewRoom(room3);
            expect(store.activeSpace).toBe(space1);
        });

        it("switch to other rooms for orphaned room", async () => {
            viewRoom(room1);
            store.setActiveSpace(space1, false);
            viewRoom(orphan1);
            expect(store.activeSpace).toBe(MetaSpace.Orphans);
        });

        it("switch to first valid space when selected metaspace is disabled", async () => {
            store.setActiveSpace(MetaSpace.People, false);
            expect(store.activeSpace).toBe(MetaSpace.People);
            await SettingsStore.setValue("Spaces.enabledMetaSpaces", null, SettingLevel.DEVICE, {
                [MetaSpace.Home]: false,
                [MetaSpace.Favourites]: true,
                [MetaSpace.People]: false,
                [MetaSpace.Orphans]: true,
            });
            jest.runAllTimers();
            expect(store.activeSpace).toBe(MetaSpace.Orphans);
        });

        it("when switching rooms in the all rooms home space don't switch to related space", async () => {
            await setShowAllRooms(true);
            viewRoom(room2);
            store.setActiveSpace(MetaSpace.Home, false);
            viewRoom(room1);
            expect(store.activeSpace).toBe(MetaSpace.Home);
        });
    });

    describe("traverseSpace", () => {
        beforeEach(() => {
            mkSpace("!a:server", [
                mkSpace("!b:server", [
                    mkSpace("!c:server", [
                        "!a:server",
                        mkRoom("!c-child:server").roomId,
                        mkRoom("!shared-child:server").roomId,
                    ]).roomId,
                    mkRoom("!b-child:server").roomId,
                ]).roomId,
                mkRoom("!a-child:server").roomId,
                "!shared-child:server",
            ]);
        });

        it("avoids cycles", () => {
            const fn = jest.fn();
            store.traverseSpace("!b:server", fn);

            expect(fn).toBeCalledTimes(3);
            expect(fn).toBeCalledWith("!a:server");
            expect(fn).toBeCalledWith("!b:server");
            expect(fn).toBeCalledWith("!c:server");
        });

        it("including rooms", () => {
            const fn = jest.fn();
            store.traverseSpace("!b:server", fn, true);

            expect(fn).toBeCalledTimes(8); // twice for shared-child
            expect(fn).toBeCalledWith("!a:server");
            expect(fn).toBeCalledWith("!a-child:server");
            expect(fn).toBeCalledWith("!b:server");
            expect(fn).toBeCalledWith("!b-child:server");
            expect(fn).toBeCalledWith("!c:server");
            expect(fn).toBeCalledWith("!c-child:server");
            expect(fn).toBeCalledWith("!shared-child:server");
        });

        it("excluding rooms", () => {
            const fn = jest.fn();
            store.traverseSpace("!b:server", fn, false);

            expect(fn).toBeCalledTimes(3);
            expect(fn).toBeCalledWith("!a:server");
            expect(fn).toBeCalledWith("!b:server");
            expect(fn).toBeCalledWith("!c:server");
        });
    });

    it("test user flow", async () => {
        // init the store
        await run();
        await setShowAllRooms(false);

        // receive invite to space
        const rootSpace = mkSpace(space1, [room1, room2, space2]);
        rootSpace.getMyMembership.mockReturnValue("invite");
        client.emit("Room", rootSpace);
        jest.runAllTimers();
        expect(SpaceStore.instance.invitedSpaces).toStrictEqual([rootSpace]);
        expect(SpaceStore.instance.spacePanelSpaces).toStrictEqual([]);

        // accept invite to space
        rootSpace.getMyMembership.mockReturnValue("join");
        client.emit("Room.myMembership", rootSpace, "join", "invite");
        jest.runAllTimers();
        expect(SpaceStore.instance.invitedSpaces).toStrictEqual([]);
        expect(SpaceStore.instance.spacePanelSpaces).toStrictEqual([rootSpace]);

        // join room in space
        expect(SpaceStore.instance.isRoomInSpace(space1, room1)).toBeFalsy();
        const rootSpaceRoom1 = mkRoom(room1);
        rootSpaceRoom1.getMyMembership.mockReturnValue("join");
        client.emit("Room", rootSpaceRoom1);
        jest.runAllTimers();
        expect(SpaceStore.instance.invitedSpaces).toStrictEqual([]);
        expect(SpaceStore.instance.spacePanelSpaces).toStrictEqual([rootSpace]);
        expect(SpaceStore.instance.isRoomInSpace(space1, room1)).toBeTruthy();
        expect(SpaceStore.instance.isRoomInSpace(MetaSpace.Home, room1)).toBeFalsy();
        expect(SpaceStore.instance.isRoomInSpace(MetaSpace.Favourites, room1)).toBeFalsy();
        expect(SpaceStore.instance.isRoomInSpace(MetaSpace.People, room1)).toBeFalsy();
        expect(SpaceStore.instance.isRoomInSpace(MetaSpace.Orphans, room1)).toBeFalsy();

        // receive room invite
        expect(SpaceStore.instance.isRoomInSpace(space1, room2)).toBeFalsy();
        const rootSpaceRoom2 = mkRoom(room2);
        rootSpaceRoom2.getMyMembership.mockReturnValue("invite");
        client.emit("Room", rootSpaceRoom2);
        jest.runAllTimers();
        expect(SpaceStore.instance.invitedSpaces).toStrictEqual([]);
        expect(SpaceStore.instance.spacePanelSpaces).toStrictEqual([rootSpace]);
        expect(SpaceStore.instance.isRoomInSpace(space1, room2)).toBeTruthy();
        expect(SpaceStore.instance.isRoomInSpace(MetaSpace.Home, room2)).toBeTruthy();
        expect(SpaceStore.instance.isRoomInSpace(MetaSpace.Favourites, room2)).toBeFalsy();
        expect(SpaceStore.instance.isRoomInSpace(MetaSpace.People, room2)).toBeFalsy();
        expect(SpaceStore.instance.isRoomInSpace(MetaSpace.Orphans, room2)).toBeFalsy();

        // start DM in space
        const myRootSpaceMember = new RoomMember(space1, testUserId);
        myRootSpaceMember.membership = "join";
        const rootSpaceFriend = new RoomMember(space1, dm1Partner.userId);
        rootSpaceFriend.membership = "join";
        rootSpace.getMembers.mockReturnValue([
            myRootSpaceMember,
            rootSpaceFriend,
        ]);
        rootSpace.getMember.mockImplementation(userId => {
            switch (userId) {
                case testUserId:
                    return myRootSpaceMember;
                case dm1Partner.userId:
                    return rootSpaceFriend;
            }
        });
        expect(SpaceStore.instance.getSpaceFilteredUserIds(space1).has(dm1Partner.userId)).toBeFalsy();
        client.emit("RoomState.members", mkEvent({
            event: true,
            type: EventType.RoomMember,
            content: {
                membership: "join",
            },
            skey: dm1Partner.userId,
            user: dm1Partner.userId,
            room: space1,
        }));
        jest.runAllTimers();
        expect(SpaceStore.instance.getSpaceFilteredUserIds(space1).has(dm1Partner.userId)).toBeTruthy();
        const dm1Room = mkRoom(dm1);
        dm1Room.getMyMembership.mockReturnValue("join");
        client.emit("Room", dm1Room);
        jest.runAllTimers();
        expect(SpaceStore.instance.invitedSpaces).toStrictEqual([]);
        expect(SpaceStore.instance.spacePanelSpaces).toStrictEqual([rootSpace]);
        expect(SpaceStore.instance.isRoomInSpace(space1, dm1)).toBeTruthy();
        expect(SpaceStore.instance.isRoomInSpace(MetaSpace.Home, dm1)).toBeTruthy();
        expect(SpaceStore.instance.isRoomInSpace(MetaSpace.Favourites, dm1)).toBeFalsy();
        expect(SpaceStore.instance.isRoomInSpace(MetaSpace.People, dm1)).toBeTruthy();
        expect(SpaceStore.instance.isRoomInSpace(MetaSpace.Orphans, dm1)).toBeFalsy();

        // join subspace
        const subspace = mkSpace(space2);
        subspace.getMyMembership.mockReturnValue("join");
        const prom = testUtils.emitPromise(SpaceStore.instance, space1);
        client.emit("Room", subspace);
        jest.runAllTimers();
        expect(SpaceStore.instance.invitedSpaces).toStrictEqual([]);
        expect(SpaceStore.instance.spacePanelSpaces.map(r => r.roomId)).toStrictEqual([rootSpace.roomId]);
        await prom;
    });
});
