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
import { setupAsyncStoreWithClient } from "../utils/test-utils";
import { createTestClient, mkEvent, mkStubRoom } from "../test-utils";
import { EnhancedMap } from "../../src/utils/maps";
import SettingsStore from "../../src/settings/SettingsStore";

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

const mkSpace = (spaceId: string, children: string[] = []) => {
    const space = mkStubRoom(spaceId);
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
    rooms.push(space);
    return space;
};

const getValue = jest.fn();
SettingsStore.getValue = getValue;

describe("SpaceStore", () => {
    const store = SpaceStore.instance;
    const client = createTestClient();

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
    afterEach(() => {
        // @ts-ignore
        store.onNotReady();
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
            // TODO verify actual tree structure
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
            // TODO verify actual tree structure
        });

        it("handles basic cycles", async () => {
            // TODO test all input order permutations
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
            // TODO verify actual tree structure
        });

        it("handles complex cycles", async () => {
            // TODO test all input order permutations
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
            // TODO verify actual tree structure
        });

        it("handles really complex cycles", async () => {
            // TODO test all input order permutations
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
            // TODO verify actual tree structure
            // TODO this test should be failing right now
        });

        describe("home space behaviour", () => {
            test.todo("home space contains orphaned rooms");
            test.todo("home space contains favourites");
            test.todo("home space contains dm rooms");
            test.todo("home space contains invites");
            test.todo("home space contains invites even if they are also shown in a space");
        });
    });

    describe("hierarchy resolution update tests", () => {
        test.todo("updates state when spaces are joined");
        test.todo("updates state when spaces are left");
        test.todo("updates state when space invite comes in");
        test.todo("updates state when space invite is accepted");
        test.todo("updates state when space invite is rejected");
    });

    describe("notification state tests", () => {
        test.todo("//notification states");
    });

    describe("room list prefilter tests", () => {
        test.todo("//room list filter");
    });

    describe("active space switching tests", () => {
        test.todo("//active space");
    });

    describe("context switching tests", () => {
        test.todo("//context switching");
    });

    describe("space auto switching tests", () => {
        test.todo("//auto pick space for a room");
    });

    describe("traverseSpace", () => {
        test.todo("avoids cycles");
        test.todo("including rooms");
        test.todo("excluding rooms");
    });
});
