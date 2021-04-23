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

import "../skinned-sdk"; // Must be first for skinning to work
import SpaceStore from "../../src/stores/SpaceStore";
import { resetAsyncStoreWithClient, setupAsyncStoreWithClient } from "../utils/test-utils";
import { mkEvent, mkStubRoom, stubClient } from "../test-utils";
import { EnhancedMap } from "../../src/utils/maps";
import SettingsStore from "../../src/settings/SettingsStore";
import DMRoomMap from "../../src/utils/DMRoomMap";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import defaultDispatcher from "../../src/dispatcher/dispatcher";

type MatrixEvent = any; // importing from js-sdk upsets things

jest.useFakeTimers();

const mockStateEventImplementation = (events: MatrixEvent[]) => {
    const stateMap = new EnhancedMap<string, Map<string, MatrixEvent>>();
    events.forEach(event => {
        stateMap.getOrCreate(event.getType(), new Map()).set(event.getStateKey(), event);
    });

    return (eventType: string, stateKey?: string) => {
        if (stateKey || stateKey === "") {
            return stateMap.get(eventType)?.get(stateKey) || null;
        }
        return Array.from(stateMap.get(eventType)?.values() || []);
    };
};

const testUserId = "@test:user";

let rooms = [];

const mkRoom = (roomId: string) => {
    const room = mkStubRoom(roomId);
    room.currentState.getStateEvents.mockImplementation(mockStateEventImplementation([]));
    rooms.push(room);
    return room;
};

const mkSpace = (spaceId: string, children: string[] = []) => {
    const space = mkRoom(spaceId);
    space.isSpaceRoom.mockReturnValue(true);
    space.currentState.getStateEvents.mockImplementation(mockStateEventImplementation(children.map(roomId =>
        mkEvent({
            event: true,
            type: EventType.SpaceChild,
            room: spaceId,
            user: testUserId,
            skey: roomId,
            content: { via: [] },
            ts: Date.now(),
        }),
    )));
    return space;
};

const getValue = jest.fn();
SettingsStore.getValue = getValue;

const getUserIdForRoomId = jest.fn();
// @ts-ignore
DMRoomMap.sharedInstance = { getUserIdForRoomId };

describe("SpaceStore", () => {
    stubClient();
    const store = SpaceStore.instance;
    const client = MatrixClientPeg.get();

    const viewRoom = roomId => defaultDispatcher.dispatch({ action: "view_room", room_id: roomId }, true);

    const run = async () => {
        client.getRoom.mockImplementation(roomId => rooms.find(room => room.roomId === roomId));
        await setupAsyncStoreWithClient(store, client);
    };

    beforeEach(() => {
        jest.runAllTimers();
        client.getVisibleRooms.mockReturnValue(rooms = []);
        getValue.mockImplementation(settingName => {
            if (settingName === "feature_spaces") {
                return true;
            }
        });
    });
    afterEach(async () => {
        await resetAsyncStoreWithClient(store);
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

        describe("test fixture 1", () => {
            const fav1 = "!fav1:server";
            const fav2 = "!fav2:server";
            const fav3 = "!fav3:server";
            const dm1 = "!dm1:server";
            const dm1Partner = "@dm1Partner:server";
            const dm2 = "!dm2:server";
            const dm2Partner = "@dm2Partner:server";
            const dm3 = "!dm3:server";
            const dm3Partner = "@dm3Partner:server";
            const orphan1 = "!orphan1:server";
            const orphan2 = "!orphan2:server";
            const invite1 = "!invite1:server";
            const invite2 = "!invite2:server";
            const spaceRoom1 = "!spaceRoom1:server";
            const space1 = "!space1:server";
            const space2 = "!space2:server";
            const space3 = "!space3:server";

            beforeEach(async () => {
                [fav1, fav2, fav3, dm1, dm2, dm3, orphan1, orphan2, invite1, invite2, spaceRoom1].forEach(mkRoom);
                mkSpace(space1, [fav1, spaceRoom1]);
                mkSpace(space2, [fav1, fav2, fav3, spaceRoom1]);
                mkSpace(space3, [invite2]);

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

                getUserIdForRoomId.mockImplementation(roomId => {
                    return {
                        [dm1]: dm1Partner,
                        [dm2]: dm2Partner,
                        [dm3]: dm3Partner,
                    }[roomId];
                });
                await run();
            });

            it("home space contains orphaned rooms", () => {
                expect(store.getSpaceFilteredRoomIds(null).has(orphan1)).toBeTruthy();
                expect(store.getSpaceFilteredRoomIds(null).has(orphan2)).toBeTruthy();
            });

            it("home space contains favourites", () => {
                expect(store.getSpaceFilteredRoomIds(null).has(fav1)).toBeTruthy();
                expect(store.getSpaceFilteredRoomIds(null).has(fav2)).toBeTruthy();
                expect(store.getSpaceFilteredRoomIds(null).has(fav3)).toBeTruthy();
            });

            it("home space contains dm rooms", () => {
                expect(store.getSpaceFilteredRoomIds(null).has(dm1)).toBeTruthy();
                expect(store.getSpaceFilteredRoomIds(null).has(dm2)).toBeTruthy();
                expect(store.getSpaceFilteredRoomIds(null).has(dm3)).toBeTruthy();
            });

            it("home space contains invites", () => {
                expect(store.getSpaceFilteredRoomIds(null).has(invite1)).toBeTruthy();
            });

            it("home space contains invites even if they are also shown in a space", () => {
                expect(store.getSpaceFilteredRoomIds(null).has(invite2)).toBeTruthy();
            });

            it("home space does not contain rooms/low priority from rooms within spaces", () => {
                expect(store.getSpaceFilteredRoomIds(null).has(spaceRoom1)).toBeFalsy();
            });

            it("space contains child rooms", () => {
                const space = client.getRoom(space1);
                expect(store.getSpaceFilteredRoomIds(space).has(fav1)).toBeTruthy();
                expect(store.getSpaceFilteredRoomIds(space).has(spaceRoom1)).toBeTruthy();
            });

            it("space contains child favourites", () => {
                const space = client.getRoom(space2);
                expect(store.getSpaceFilteredRoomIds(space).has(fav1)).toBeTruthy();
                expect(store.getSpaceFilteredRoomIds(space).has(fav2)).toBeTruthy();
                expect(store.getSpaceFilteredRoomIds(space).has(fav3)).toBeTruthy();
                expect(store.getSpaceFilteredRoomIds(space).has(spaceRoom1)).toBeTruthy();
            });

            it("space contains child invites", () => {
                const space = client.getRoom(space3);
                expect(store.getSpaceFilteredRoomIds(space).has(invite2)).toBeTruthy();
            });
        });
    });

    describe("hierarchy resolution update tests", () => {
        test.todo("updates state when spaces are joined");
        test.todo("updates state when spaces are left");
        test.todo("updates state when space invite comes in");
        test.todo("updates state when space invite is accepted");
        test.todo("updates state when space invite is rejected");
    });

    describe("active space switching tests", () => {
        test.todo("//active space");
    });

    describe("notification state tests", () => {
        test.todo("//notification states");
    });

    describe("room list prefilter tests", () => {
        test.todo("//room list filter");
    });

    describe("context switching tests", () => {
        test.todo("//context switching");
    });

    describe("space auto switching tests", () => {
        const space1 = "!space1:server";
        const space2 = "!space2:server";
        const room1 = "!room1:server"; // in space 1 & 2
        const room2 = "!room2:server"; // in space 1 & 2 (canonical)
        const orphan1 = "!orphan:server";

        beforeEach(async () => {
            [room1, room2, orphan1].forEach(mkRoom);
            mkSpace(space1, [room1, room2]);
            mkSpace(space2, [room1, room2]);

            client.getRoom(room2).currentState.getStateEvents.mockImplementation(mockStateEventImplementation([
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
            await store.setActiveSpace(client.getRoom(space1), false);
            viewRoom(room2);
            expect(store.activeSpace).toBe(client.getRoom(space1));
        });

        it("switch to canonical parent space for room", async () => {
            viewRoom(room1);
            await store.setActiveSpace(null, false);
            viewRoom(room2);
            expect(store.activeSpace).toBe(client.getRoom(space2));
        });

        it("switch to first containing space for room", async () => {
            viewRoom(room2);
            await store.setActiveSpace(null, false);
            viewRoom(room1);
            expect(store.activeSpace).toBe(client.getRoom(space1));
        });

        it("switch to home for orphaned room", async () => {
            viewRoom(room1);
            await store.setActiveSpace(client.getRoom(space1), false);
            viewRoom(orphan1);
            expect(store.activeSpace).toBeNull();
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
});
