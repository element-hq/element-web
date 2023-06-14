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

import { IContent, MatrixClient } from "../../../src";
import { Room } from "../../../src/models/room";
import { MatrixEvent } from "../../../src/models/event";
import { EventType, MsgType, UNSTABLE_MSC3089_BRANCH, UNSTABLE_MSC3089_LEAF } from "../../../src/@types/event";
import {
    DEFAULT_TREE_POWER_LEVELS_TEMPLATE,
    MSC3089TreeSpace,
    TreePermissions,
} from "../../../src/models/MSC3089TreeSpace";
import { DEFAULT_ALPHABET } from "../../../src/utils";
import { MatrixError } from "../../../src/http-api";

describe("MSC3089TreeSpace", () => {
    let client: MatrixClient;
    let room: any;
    let tree: MSC3089TreeSpace;
    const roomId = "!tree:localhost";
    const targetUser = "@target:example.org";

    let powerLevels: MatrixEvent;

    beforeEach(() => {
        // TODO: Use utility functions to create test rooms and clients
        client = <MatrixClient>{
            getRoom: (fetchRoomId: string) => {
                if (fetchRoomId === roomId) {
                    return room;
                } else {
                    throw new Error("Unexpected fetch for unknown room");
                }
            },
        };
        room = <Room>{
            currentState: {
                getStateEvents: (evType: EventType, stateKey: string) => {
                    if (evType === EventType.RoomPowerLevels && stateKey === "") {
                        return powerLevels;
                    } else {
                        throw new Error("Accessed unexpected state event type or key");
                    }
                },
            },
        };
        tree = new MSC3089TreeSpace(client, roomId);
        makePowerLevels(DEFAULT_TREE_POWER_LEVELS_TEMPLATE);
    });

    function makePowerLevels(content: any) {
        powerLevels = new MatrixEvent({
            type: EventType.RoomPowerLevels,
            state_key: "",
            sender: "@creator:localhost",
            event_id: "$powerlevels",
            room_id: roomId,
            content: content,
        });
    }

    it("should populate the room reference", () => {
        expect(tree.room).toBe(room);
    });

    it("should proxy the ID member to room ID", () => {
        expect(tree.id).toEqual(tree.roomId);
        expect(tree.id).toEqual(roomId);
    });

    it("should support setting the name of the space", async () => {
        const newName = "NEW NAME";
        const fn = jest
            .fn()
            .mockImplementation((stateRoomId: string, eventType: EventType, content: any, stateKey: string) => {
                expect(stateRoomId).toEqual(roomId);
                expect(eventType).toEqual(EventType.RoomName);
                expect(stateKey).toEqual("");
                expect(content).toMatchObject({ name: newName });
                return Promise.resolve();
            });
        client.sendStateEvent = fn;
        await tree.setName(newName);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should support inviting users to the space", async () => {
        const target = targetUser;
        const fn = jest.fn().mockImplementation((inviteRoomId: string, userId: string) => {
            expect(inviteRoomId).toEqual(roomId);
            expect(userId).toEqual(target);
            return Promise.resolve();
        });
        client.invite = fn;
        await tree.invite(target, false, false);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry invites to the space", async () => {
        const target = targetUser;
        const fn = jest.fn().mockImplementation((inviteRoomId: string, userId: string) => {
            expect(inviteRoomId).toEqual(roomId);
            expect(userId).toEqual(target);
            if (fn.mock.calls.length === 1) return Promise.reject(new Error("Sample Failure"));
            return Promise.resolve();
        });
        client.invite = fn;
        await tree.invite(target, false, false);
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should not retry invite permission errors", async () => {
        const target = targetUser;
        const fn = jest.fn().mockImplementation((inviteRoomId: string, userId: string) => {
            expect(inviteRoomId).toEqual(roomId);
            expect(userId).toEqual(target);
            return Promise.reject(new MatrixError({ errcode: "M_FORBIDDEN", error: "Sample Failure" }));
        });
        client.invite = fn;

        await expect(tree.invite(target, false, false)).rejects.toThrow("MatrixError: Sample Failure");

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should invite to subspaces", async () => {
        const target = targetUser;
        const fn = jest.fn().mockImplementation((inviteRoomId: string, userId: string) => {
            expect(inviteRoomId).toEqual(roomId);
            expect(userId).toEqual(target);
            return Promise.resolve();
        });
        client.invite = fn;
        tree.getDirectories = () => [
            // Bare minimum overrides. We proxy to our mock function manually so we can
            // count the calls, not to ensure accuracy. The invite function behaving correctly
            // is covered by another test.
            { invite: (userId) => fn(tree.roomId, userId) } as MSC3089TreeSpace,
            { invite: (userId) => fn(tree.roomId, userId) } as MSC3089TreeSpace,
            { invite: (userId) => fn(tree.roomId, userId) } as MSC3089TreeSpace,
        ];

        await tree.invite(target, true, false);
        expect(fn).toHaveBeenCalledTimes(4);
    });

    it("should share keys with invitees", async () => {
        const target = targetUser;
        const sendKeysFn = jest.fn().mockImplementation((inviteRoomId: string, userIds: string[]) => {
            expect(inviteRoomId).toEqual(roomId);
            expect(userIds).toMatchObject([target]);
            return Promise.resolve();
        });
        client.invite = () => Promise.resolve({}); // we're not testing this here - see other tests
        client.sendSharedHistoryKeys = sendKeysFn;

        // Mock the history check as best as possible
        const historyVis = "shared";
        const historyFn = jest.fn().mockImplementation((eventType: string, stateKey?: string) => {
            // We're not expecting a super rigid test: the function that calls this internally isn't
            // really being tested here.
            expect(eventType).toEqual(EventType.RoomHistoryVisibility);
            expect(stateKey).toEqual("");
            return { getContent: () => ({ history_visibility: historyVis }) }; // eslint-disable-line camelcase
        });
        room.currentState.getStateEvents = historyFn;

        // Note: inverse test is implicit from other tests, which disable the call stack of this
        // test in order to pass.
        await tree.invite(target, false, true);
        expect(sendKeysFn).toHaveBeenCalledTimes(1);
        expect(historyFn).toHaveBeenCalledTimes(1);
    });

    it("should not share keys with invitees if inappropriate history visibility", async () => {
        const target = targetUser;
        const sendKeysFn = jest.fn().mockImplementation((inviteRoomId: string, userIds: string[]) => {
            expect(inviteRoomId).toEqual(roomId);
            expect(userIds).toMatchObject([target]);
            return Promise.resolve();
        });
        client.invite = () => Promise.resolve({}); // we're not testing this here - see other tests
        client.sendSharedHistoryKeys = sendKeysFn;

        const historyVis = "joined"; // NOTE: Changed.
        const historyFn = jest.fn().mockImplementation((eventType: string, stateKey?: string) => {
            expect(eventType).toEqual(EventType.RoomHistoryVisibility);
            expect(stateKey).toEqual("");
            return { getContent: () => ({ history_visibility: historyVis }) }; // eslint-disable-line camelcase
        });
        room.currentState.getStateEvents = historyFn;

        await tree.invite(target, false, true);
        expect(sendKeysFn).toHaveBeenCalledTimes(0);
        expect(historyFn).toHaveBeenCalledTimes(1);
    });

    async function evaluatePowerLevels(pls: any, role: TreePermissions, expectedPl: number) {
        makePowerLevels(pls);
        const fn = jest
            .fn()
            .mockImplementation((stateRoomId: string, eventType: EventType, content: any, stateKey: string) => {
                expect(stateRoomId).toEqual(roomId);
                expect(eventType).toEqual(EventType.RoomPowerLevels);
                expect(stateKey).toEqual("");
                expect(content).toMatchObject({
                    ...pls,
                    users: {
                        [targetUser]: expectedPl,
                    },
                });

                // Store new power levels so the `getPermissions()` test passes
                makePowerLevels(content);

                return Promise.resolve();
            });
        client.sendStateEvent = fn;
        await tree.setPermissions(targetUser, role);
        expect(fn.mock.calls.length).toBe(1);

        const finalPermissions = tree.getPermissions(targetUser);
        expect(finalPermissions).toEqual(role);
    }

    it("should support setting Viewer permissions", () => {
        return evaluatePowerLevels(
            {
                ...DEFAULT_TREE_POWER_LEVELS_TEMPLATE,
                users_default: 1024,
                events_default: 1025,
                events: {
                    [EventType.RoomPowerLevels]: 1026,
                },
            },
            TreePermissions.Viewer,
            1024,
        );
    });

    it("should support setting Editor permissions", () => {
        return evaluatePowerLevels(
            {
                ...DEFAULT_TREE_POWER_LEVELS_TEMPLATE,
                users_default: 1024,
                events_default: 1025,
                events: {
                    [EventType.RoomPowerLevels]: 1026,
                },
            },
            TreePermissions.Editor,
            1025,
        );
    });

    it("should support setting Owner permissions", () => {
        return evaluatePowerLevels(
            {
                ...DEFAULT_TREE_POWER_LEVELS_TEMPLATE,
                users_default: 1024,
                events_default: 1025,
                events: {
                    [EventType.RoomPowerLevels]: 1026,
                },
            },
            TreePermissions.Owner,
            1026,
        );
    });

    it("should support demoting permissions", () => {
        return evaluatePowerLevels(
            {
                ...DEFAULT_TREE_POWER_LEVELS_TEMPLATE,
                users_default: 1024,
                events_default: 1025,
                events: {
                    [EventType.RoomPowerLevels]: 1026,
                },
                users: {
                    [targetUser]: 2222,
                },
            },
            TreePermissions.Viewer,
            1024,
        );
    });

    it("should support promoting permissions", () => {
        return evaluatePowerLevels(
            {
                ...DEFAULT_TREE_POWER_LEVELS_TEMPLATE,
                users_default: 1024,
                events_default: 1025,
                events: {
                    [EventType.RoomPowerLevels]: 1026,
                },
                users: {
                    [targetUser]: 5,
                },
            },
            TreePermissions.Editor,
            1025,
        );
    });

    it("should support defaults: Viewer", () => {
        return evaluatePowerLevels({}, TreePermissions.Viewer, 0);
    });

    it("should support defaults: Editor", () => {
        return evaluatePowerLevels({}, TreePermissions.Editor, 50);
    });

    it("should support defaults: Owner", () => {
        return evaluatePowerLevels({}, TreePermissions.Owner, 100);
    });

    it("should create subdirectories", async () => {
        const subspaceName = "subdirectory";
        const subspaceId = "!subspace:localhost";
        const domain = "domain.example.com";
        client.getRoom = (roomId: string) => {
            if (roomId === tree.roomId) {
                return tree.room;
            } else if (roomId === subspaceId) {
                return {} as Room; // we don't need anything important off of this
            } else {
                throw new Error("Unexpected getRoom call");
            }
        };
        client.getDomain = () => domain;
        const createFn = jest.fn().mockImplementation(async (name: string) => {
            expect(name).toEqual(subspaceName);
            return new MSC3089TreeSpace(client, subspaceId);
        });
        const sendStateFn = jest
            .fn()
            .mockImplementation(async (roomId: string, eventType: EventType, content: any, stateKey: string) => {
                expect([tree.roomId, subspaceId]).toContain(roomId);

                let expectedType: string;
                let expectedStateKey: string;
                if (roomId === subspaceId) {
                    expectedType = EventType.SpaceParent;
                    expectedStateKey = tree.roomId;
                } else {
                    expectedType = EventType.SpaceChild;
                    expectedStateKey = subspaceId;
                }
                expect(eventType).toEqual(expectedType);
                expect(stateKey).toEqual(expectedStateKey);
                expect(content).toMatchObject({ via: [domain] });

                // return value not used
            });
        client.unstableCreateFileTree = createFn;
        client.sendStateEvent = sendStateFn;

        const directory = await tree.createDirectory(subspaceName);
        expect(directory).toBeDefined();
        expect(directory).not.toBeNull();
        expect(directory).not.toBe(tree);
        expect(directory.roomId).toEqual(subspaceId);
        expect(createFn).toHaveBeenCalledTimes(1);
        expect(sendStateFn).toHaveBeenCalledTimes(2);

        const content = expect.objectContaining({ via: [domain] });
        expect(sendStateFn).toHaveBeenCalledWith(subspaceId, EventType.SpaceParent, content, tree.roomId);
        expect(sendStateFn).toHaveBeenCalledWith(tree.roomId, EventType.SpaceChild, content, subspaceId);
    });

    it("should find subdirectories", () => {
        const firstChildRoom = "!one:example.org";
        const secondChildRoom = "!two:example.org";
        const thirdChildRoom = "!three:example.org"; // to ensure it doesn't end up in the subdirectories
        room.currentState = {
            getStateEvents: (eventType: EventType, stateKey?: string) => {
                expect(eventType).toEqual(EventType.SpaceChild);
                expect(stateKey).toBeUndefined();
                return [
                    // Partial implementations of Room
                    { getStateKey: () => firstChildRoom },
                    { getStateKey: () => secondChildRoom },
                    { getStateKey: () => thirdChildRoom },
                ];
            },
        };
        client.getRoom = () => ({} as Room); // to appease the TreeSpace constructor

        const getFn = jest.fn().mockImplementation((roomId: string) => {
            if (roomId === thirdChildRoom) {
                throw new Error("Mock not-a-space room case called (expected)");
            }
            expect([firstChildRoom, secondChildRoom]).toContain(roomId);
            return new MSC3089TreeSpace(client, roomId);
        });
        client.unstableGetFileTreeSpace = getFn;

        const subdirectories = tree.getDirectories();
        expect(subdirectories).toBeDefined();
        expect(subdirectories.length).toBe(2);
        expect(subdirectories[0].roomId).toBe(firstChildRoom);
        expect(subdirectories[1].roomId).toBe(secondChildRoom);
        expect(getFn).toHaveBeenCalledTimes(3);
        expect(getFn).toHaveBeenCalledWith(firstChildRoom);
        expect(getFn).toHaveBeenCalledWith(secondChildRoom);
        expect(getFn).toHaveBeenCalledWith(thirdChildRoom); // check to make sure it tried
    });

    it("should find specific directories", () => {
        client.getRoom = () => ({} as Room); // to appease the TreeSpace constructor

        // Only mocking used API
        const firstSubdirectory = { roomId: "!first:example.org" } as any as MSC3089TreeSpace;
        const searchedSubdirectory = { roomId: "!find_me:example.org" } as any as MSC3089TreeSpace;
        const thirdSubdirectory = { roomId: "!third:example.org" } as any as MSC3089TreeSpace;
        tree.getDirectories = () => [firstSubdirectory, searchedSubdirectory, thirdSubdirectory];

        let result = tree.getDirectory(searchedSubdirectory.roomId);
        expect(result).toBe(searchedSubdirectory);

        result = tree.getDirectory("not a subdirectory");
        expect(result).toBeFalsy();
    });

    it("should be able to delete itself", async () => {
        const delete1 = jest.fn().mockImplementation(() => Promise.resolve());
        const subdir1 = { delete: delete1 } as any as MSC3089TreeSpace; // mock tested bits

        const delete2 = jest.fn().mockImplementation(() => Promise.resolve());
        const subdir2 = { delete: delete2 } as any as MSC3089TreeSpace; // mock tested bits

        const joinMemberId = "@join:example.org";
        const knockMemberId = "@knock:example.org";
        const inviteMemberId = "@invite:example.org";
        const leaveMemberId = "@leave:example.org";
        const banMemberId = "@ban:example.org";
        const selfUserId = "@self:example.org";

        tree.getDirectories = () => [subdir1, subdir2];
        room.currentState = {
            getStateEvents: (eventType: EventType, stateKey?: string) => {
                expect(eventType).toEqual(EventType.RoomMember);
                expect(stateKey).toBeUndefined();
                return [
                    // Partial implementations
                    { getContent: () => ({ membership: "join" }), getStateKey: () => joinMemberId },
                    { getContent: () => ({ membership: "knock" }), getStateKey: () => knockMemberId },
                    { getContent: () => ({ membership: "invite" }), getStateKey: () => inviteMemberId },
                    { getContent: () => ({ membership: "leave" }), getStateKey: () => leaveMemberId },
                    { getContent: () => ({ membership: "ban" }), getStateKey: () => banMemberId },

                    // ensure we don't kick ourselves
                    { getContent: () => ({ membership: "join" }), getStateKey: () => selfUserId },
                ];
            },
        };

        // These two functions are tested by input expectations, so no expectations in the function bodies
        const kickFn = jest.fn().mockImplementation((userId) => Promise.resolve());
        const leaveFn = jest.fn().mockImplementation(() => Promise.resolve());
        client.kick = kickFn;
        client.leave = leaveFn;
        client.getUserId = () => selfUserId;

        await tree.delete();

        expect(delete1).toHaveBeenCalledTimes(1);
        expect(delete2).toHaveBeenCalledTimes(1);
        expect(kickFn).toHaveBeenCalledTimes(3);
        expect(kickFn).toHaveBeenCalledWith(tree.roomId, joinMemberId, expect.any(String));
        expect(kickFn).toHaveBeenCalledWith(tree.roomId, knockMemberId, expect.any(String));
        expect(kickFn).toHaveBeenCalledWith(tree.roomId, inviteMemberId, expect.any(String));
        expect(leaveFn).toHaveBeenCalledTimes(1);
    });

    describe("get and set order", () => {
        // Danger: these are partial implementations for testing purposes only

        // @ts-ignore - "MatrixEvent is a value but used as a type", which is true but not important
        let childState: { [roomId: string]: any[] } = {};
        // @ts-ignore - "MatrixEvent is a value but used as a type", which is true but not important
        let parentState: any[] = [];
        let parentRoom: Room;
        let childTrees: MSC3089TreeSpace[];
        let rooms: { [roomId: string]: Room };
        let clientSendStateFn: jest.MockedFunction<typeof client.sendStateEvent>;
        const staticDomain = "static.example.org";

        function addSubspace(roomId: string, createTs?: number, order?: string) {
            const content: IContent = {
                via: [staticDomain],
            };
            if (order) content["order"] = order;
            parentState.push({
                getType: () => EventType.SpaceChild,
                getStateKey: () => roomId,
                getContent: () => content,
            });
            childState[roomId] = [
                {
                    getType: () => EventType.SpaceParent,
                    getStateKey: () => tree.roomId,
                    getContent: () => ({
                        via: [staticDomain],
                    }),
                },
            ];
            if (createTs) {
                childState[roomId].push({
                    getType: () => EventType.RoomCreate,
                    getStateKey: () => "",
                    getContent: () => ({}),
                    getTs: () => createTs,
                });
            }
            rooms[roomId] = makeMockChildRoom(roomId);
            childTrees.push(new MSC3089TreeSpace(client, roomId));
        }

        function expectOrder(childRoomId: string, order: number) {
            const child = childTrees.find((c) => c.roomId === childRoomId);
            expect(child).toBeDefined();
            expect(child!.getOrder()).toEqual(order);
        }

        function makeMockChildRoom(roomId: string): Room {
            return {
                currentState: {
                    getStateEvents: (eventType: EventType, stateKey?: string) => {
                        expect([EventType.SpaceParent, EventType.RoomCreate]).toContain(eventType);
                        if (eventType === EventType.RoomCreate) {
                            expect(stateKey).toEqual("");
                            return childState[roomId].find((e) => e.getType() === EventType.RoomCreate);
                        } else {
                            expect(stateKey).toBeUndefined();
                            return childState[roomId].filter((e) => e.getType() === eventType);
                        }
                    },
                },
            } as Room; // partial
        }

        beforeEach(() => {
            childState = {};
            parentState = [];
            parentRoom = {
                ...tree.room,
                roomId: tree.roomId,
                currentState: {
                    getStateEvents: (eventType: EventType, stateKey?: string) => {
                        expect([EventType.SpaceChild, EventType.RoomCreate, EventType.SpaceParent]).toContain(
                            eventType,
                        );

                        if (eventType === EventType.RoomCreate) {
                            expect(stateKey).toEqual("");
                            return parentState.filter((e) => e.getType() === EventType.RoomCreate)[0];
                        } else {
                            if (stateKey !== undefined) {
                                expect(Object.keys(rooms)).toContain(stateKey);
                                expect(stateKey).not.toEqual(tree.roomId);
                                return parentState.find(
                                    (e) => e.getType() === eventType && e.getStateKey() === stateKey,
                                );
                            } // else fine
                            return parentState.filter((e) => e.getType() === eventType);
                        }
                    },
                },
            } as Room;
            childTrees = [];
            rooms = {};
            rooms[tree.roomId] = parentRoom;
            (<any>tree).room = parentRoom; // override readonly
            client.getRoom = (r) => rooms[r ?? ""];

            clientSendStateFn = jest
                .fn()
                .mockImplementation((roomId: string, eventType: EventType, content: any, stateKey: string) => {
                    expect(roomId).toEqual(tree.roomId);
                    expect(eventType).toEqual(EventType.SpaceChild);
                    expect(content).toMatchObject(
                        expect.objectContaining({
                            via: expect.any(Array),
                            order: expect.any(String),
                        }),
                    );
                    expect(Object.keys(rooms)).toContain(stateKey);
                    expect(stateKey).not.toEqual(tree.roomId);

                    const stateEvent = parentState.find(
                        (e) => e.getType() === eventType && e.getStateKey() === stateKey,
                    );
                    expect(stateEvent).toBeDefined();
                    stateEvent.getContent = () => content;

                    return Promise.resolve(); // return value not used
                });
            client.sendStateEvent = clientSendStateFn;
        });

        it("should know when something is top level", () => {
            const a = "!a:example.org";
            addSubspace(a);

            expect(tree.isTopLevel).toBe(true);
            expect(childTrees[0].isTopLevel).toBe(false); // a bit of a hack to get at this, but it's fine
        });

        it("should return -1 for top level spaces", () => {
            // The tree is what we've defined as top level, so it should work
            expect(tree.getOrder()).toEqual(-1);
        });

        it("should throw when setting an order at the top level space", async () => {
            // The tree is what we've defined as top level, so it should work
            await expect(tree.setOrder(2)).rejects.toThrow("Cannot set order of top level spaces currently");
        });

        it("should return a stable order for unordered children", () => {
            const a = "!a:example.org";
            const b = "!b:example.org";
            const c = "!c:example.org";

            // Add in reverse order to make sure it gets ordered correctly
            addSubspace(c, 3);
            addSubspace(b, 2);
            addSubspace(a, 1);

            expectOrder(a, 0);
            expectOrder(b, 1);
            expectOrder(c, 2);
        });

        it("should return a stable order for ordered children", () => {
            const a = "!a:example.org";
            const b = "!b:example.org";
            const c = "!c:example.org";

            // Add in reverse order to make sure it gets ordered correctly
            addSubspace(a, 1, "Z");
            addSubspace(b, 2, "Y");
            addSubspace(c, 3, "X");

            expectOrder(c, 0);
            expectOrder(b, 1);
            expectOrder(a, 2);
        });

        it("should return a stable order for partially ordered children", () => {
            const a = "!a:example.org";
            const b = "!b:example.org";
            const c = "!c:example.org";
            const d = "!d:example.org";

            // Add in reverse order to make sure it gets ordered correctly
            addSubspace(a, 1);
            addSubspace(b, 2);
            addSubspace(c, 3, "Y");
            addSubspace(d, 4, "X");

            expectOrder(d, 0);
            expectOrder(c, 1);
            expectOrder(b, 3); // note order diff due to room ID comparison expectation
            expectOrder(a, 2);
        });

        it("should return a stable order if the create event timestamps are the same", () => {
            const a = "!a:example.org";
            const b = "!b:example.org";
            const c = "!c:example.org";

            // Add in reverse order to make sure it gets ordered correctly
            addSubspace(c, 3);
            addSubspace(b, 3); // same as C
            addSubspace(a, 3); // same as C

            expectOrder(a, 0);
            expectOrder(b, 1);
            expectOrder(c, 2);
        });

        it("should return a stable order if there are no known create events", () => {
            const a = "!a:example.org";
            const b = "!b:example.org";
            const c = "!c:example.org";

            // Add in reverse order to make sure it gets ordered correctly
            addSubspace(c);
            addSubspace(b);
            addSubspace(a);

            expectOrder(a, 0);
            expectOrder(b, 1);
            expectOrder(c, 2);
        });

        // XXX: These tests rely on `getOrder()` re-calculating and not caching values.

        it("should allow reordering within unordered children", async () => {
            const a = "!a:example.org";
            const b = "!b:example.org";
            const c = "!c:example.org";

            // Add in reverse order to make sure it gets ordered correctly
            addSubspace(c, 3);
            addSubspace(b, 2);
            addSubspace(a, 1);

            // Order of this state is validated by other tests.

            const treeA = childTrees.find((c) => c.roomId === a);
            expect(treeA).toBeDefined();
            await treeA!.setOrder(1);

            expect(clientSendStateFn).toHaveBeenCalledTimes(3);
            expect(clientSendStateFn).toHaveBeenCalledWith(
                tree.roomId,
                EventType.SpaceChild,
                expect.objectContaining({
                    via: [staticDomain], // should retain domain independent of client.getDomain()

                    // Because of how the reordering works (maintain stable ordering before moving), we end up calling this
                    // function twice for the same room.
                    order: DEFAULT_ALPHABET[0],
                }),
                a,
            );
            expect(clientSendStateFn).toHaveBeenCalledWith(
                tree.roomId,
                EventType.SpaceChild,
                expect.objectContaining({
                    via: [staticDomain], // should retain domain independent of client.getDomain()
                    order: DEFAULT_ALPHABET[1],
                }),
                b,
            );
            expect(clientSendStateFn).toHaveBeenCalledWith(
                tree.roomId,
                EventType.SpaceChild,
                expect.objectContaining({
                    via: [staticDomain], // should retain domain independent of client.getDomain()
                    order: DEFAULT_ALPHABET[2],
                }),
                a,
            );
            expectOrder(a, 1);
            expectOrder(b, 0);
            expectOrder(c, 2);
        });

        it("should allow reordering within ordered children", async () => {
            const a = "!a:example.org";
            const b = "!b:example.org";
            const c = "!c:example.org";

            // Add in reverse order to make sure it gets ordered correctly
            addSubspace(c, 3, "Z");
            addSubspace(b, 2, "X");
            addSubspace(a, 1, "V");

            // Order of this state is validated by other tests.

            const treeA = childTrees.find((c) => c.roomId === a);
            expect(treeA).toBeDefined();
            await treeA!.setOrder(1);

            expect(clientSendStateFn).toHaveBeenCalledTimes(1);
            expect(clientSendStateFn).toHaveBeenCalledWith(
                tree.roomId,
                EventType.SpaceChild,
                expect.objectContaining({
                    via: [staticDomain], // should retain domain independent of client.getDomain()
                    order: "Y",
                }),
                a,
            );
            expectOrder(a, 1);
            expectOrder(b, 0);
            expectOrder(c, 2);
        });

        it("should allow reordering within partially ordered children", async () => {
            const a = "!a:example.org";
            const b = "!b:example.org";
            const c = "!c:example.org";
            const d = "!d:example.org";

            // Add in reverse order to make sure it gets ordered correctly
            addSubspace(a, 1);
            addSubspace(b, 2);
            addSubspace(c, 3, "Y");
            addSubspace(d, 4, "W");

            // Order of this state is validated by other tests.

            const treeA = childTrees.find((c) => c.roomId === a);
            expect(treeA).toBeDefined();
            await treeA!.setOrder(2);

            expect(clientSendStateFn).toHaveBeenCalledTimes(1);
            expect(clientSendStateFn).toHaveBeenCalledWith(
                tree.roomId,
                EventType.SpaceChild,
                expect.objectContaining({
                    via: [staticDomain], // should retain domain independent of client.getDomain()
                    order: "Z",
                }),
                a,
            );
            expectOrder(a, 2);
            expectOrder(b, 3);
            expectOrder(c, 1);
            expectOrder(d, 0);
        });

        it("should support moving upwards", async () => {
            const a = "!a:example.org";
            const b = "!b:example.org";
            const c = "!c:example.org";
            const d = "!d:example.org";

            // Add in reverse order to make sure it gets ordered correctly
            addSubspace(d, 4, "Z");
            addSubspace(c, 3, "X");
            addSubspace(b, 2, "V");
            addSubspace(a, 1, "T");

            // Order of this state is validated by other tests.

            const treeB = childTrees.find((c) => c.roomId === b);
            expect(treeB).toBeDefined();
            await treeB!.setOrder(2);

            expect(clientSendStateFn).toHaveBeenCalledTimes(1);
            expect(clientSendStateFn).toHaveBeenCalledWith(
                tree.roomId,
                EventType.SpaceChild,
                expect.objectContaining({
                    via: [staticDomain], // should retain domain independent of client.getDomain()
                    order: "Y",
                }),
                b,
            );
            expectOrder(a, 0);
            expectOrder(b, 2);
            expectOrder(c, 1);
            expectOrder(d, 3);
        });

        it("should support moving downwards", async () => {
            const a = "!a:example.org";
            const b = "!b:example.org";
            const c = "!c:example.org";
            const d = "!d:example.org";

            // Add in reverse order to make sure it gets ordered correctly
            addSubspace(d, 4, "Z");
            addSubspace(c, 3, "X");
            addSubspace(b, 2, "V");
            addSubspace(a, 1, "T");

            // Order of this state is validated by other tests.

            const treeC = childTrees.find((ch) => ch.roomId === c);
            expect(treeC).toBeDefined();
            await treeC!.setOrder(1);

            expect(clientSendStateFn).toHaveBeenCalledTimes(1);
            expect(clientSendStateFn).toHaveBeenCalledWith(
                tree.roomId,
                EventType.SpaceChild,
                expect.objectContaining({
                    via: [staticDomain], // should retain domain independent of client.getDomain()
                    order: "U",
                }),
                c,
            );
            expectOrder(a, 0);
            expectOrder(b, 2);
            expectOrder(c, 1);
            expectOrder(d, 3);
        });

        it("should support moving over the partial ordering boundary", async () => {
            const a = "!a:example.org";
            const b = "!b:example.org";
            const c = "!c:example.org";
            const d = "!d:example.org";

            // Add in reverse order to make sure it gets ordered correctly
            addSubspace(d, 4);
            addSubspace(c, 3);
            addSubspace(b, 2, "V");
            addSubspace(a, 1, "T");

            // Order of this state is validated by other tests.

            const treeB = childTrees.find((ch) => ch.roomId === b);
            expect(treeB).toBeDefined();
            await treeB!.setOrder(2);

            expect(clientSendStateFn).toHaveBeenCalledTimes(2);
            expect(clientSendStateFn).toHaveBeenCalledWith(
                tree.roomId,
                EventType.SpaceChild,
                expect.objectContaining({
                    via: [staticDomain], // should retain domain independent of client.getDomain()
                    order: "W",
                }),
                c,
            );
            expect(clientSendStateFn).toHaveBeenCalledWith(
                tree.roomId,
                EventType.SpaceChild,
                expect.objectContaining({
                    via: [staticDomain], // should retain domain independent of client.getDomain()
                    order: "X",
                }),
                b,
            );
            expectOrder(a, 0);
            expectOrder(b, 2);
            expectOrder(c, 1);
            expectOrder(d, 3);
        });
    });

    it("should upload files", async () => {
        const mxc = "mxc://example.org/file";
        const fileInfo = {
            mimetype: "text/plain",
            // other fields as required by encryption, but ignored here
        };
        const fileEventId = "$file";
        const fileName = "My File.txt";
        const fileContents = "This is a test file";

        const uploadFn = jest.fn().mockImplementation((contents: Buffer, opts: any) => {
            expect(contents.length).toEqual(fileContents.length);
            expect(opts).toMatchObject({
                includeFilename: false,
            });
            return Promise.resolve({ content_uri: mxc });
        });
        client.uploadContent = uploadFn;

        const sendMsgFn = jest.fn().mockImplementation((roomId: string, contents: any) => {
            expect(roomId).toEqual(tree.roomId);
            expect(contents).toMatchObject({
                msgtype: MsgType.File,
                body: fileName,
                url: mxc,
                file: fileInfo,
                metadata: true, // additional content from test
                [UNSTABLE_MSC3089_LEAF.unstable!]: {}, // test to ensure we're definitely using unstable
            });

            return Promise.resolve({ event_id: fileEventId }); // eslint-disable-line camelcase
        });
        client.sendMessage = sendMsgFn;

        const sendStateFn = jest
            .fn()
            .mockImplementation((roomId: string, eventType: string, content: any, stateKey: string) => {
                expect(roomId).toEqual(tree.roomId);
                expect(eventType).toEqual(UNSTABLE_MSC3089_BRANCH.unstable); // test to ensure we're definitely using unstable
                expect(stateKey).toEqual(fileEventId);
                expect(content).toMatchObject({
                    active: true,
                    name: fileName,
                });

                return Promise.resolve({ event_id: "wrong" }); // return value shouldn't be used
            });
        client.sendStateEvent = sendStateFn;

        const buf = Buffer.from(fileContents);

        // We clone the file info just to make sure it doesn't get mutated for the test.
        const result = await tree.createFile(fileName, buf, Object.assign({}, fileInfo), { metadata: true });
        expect(result).toMatchObject({ event_id: fileEventId });

        expect(uploadFn).toHaveBeenCalledTimes(1);
        expect(sendMsgFn).toHaveBeenCalledTimes(1);
        expect(sendStateFn).toHaveBeenCalledTimes(1);
    });

    it("should upload file versions", async () => {
        const mxc = "mxc://example.org/file";
        const fileInfo = {
            mimetype: "text/plain",
            // other fields as required by encryption, but ignored here
        };
        const fileEventId = "$file";
        const fileName = "My File.txt";
        const fileContents = "This is a test file";

        const uploadFn = jest.fn().mockImplementation((contents: Buffer, opts: any) => {
            expect(contents.length).toEqual(fileContents.length);
            expect(opts).toMatchObject({
                includeFilename: false,
            });
            return Promise.resolve({ content_uri: mxc });
        });
        client.uploadContent = uploadFn;

        const sendMsgFn = jest.fn().mockImplementation((roomId: string, contents: any) => {
            expect(roomId).toEqual(tree.roomId);
            const content = {
                msgtype: MsgType.File,
                body: fileName,
                url: mxc,
                file: fileInfo,
            };
            expect(contents).toMatchObject({
                ...content,
                "m.new_content": content,
                [UNSTABLE_MSC3089_LEAF.unstable!]: {}, // test to ensure we're definitely using unstable
            });

            return Promise.resolve({ event_id: fileEventId }); // eslint-disable-line camelcase
        });
        client.sendMessage = sendMsgFn;

        const sendStateFn = jest
            .fn()
            .mockImplementation((roomId: string, eventType: string, content: any, stateKey: string) => {
                expect(roomId).toEqual(tree.roomId);
                expect(eventType).toEqual(UNSTABLE_MSC3089_BRANCH.unstable); // test to ensure we're definitely using unstable
                expect(stateKey).toEqual(fileEventId);
                expect(content).toMatchObject({
                    active: true,
                    name: fileName,
                });

                return Promise.resolve({ event_id: "wrong" }); // return value shouldn't be used
            });
        client.sendStateEvent = sendStateFn;

        const buf = Buffer.from(fileContents);

        // We clone the file info just to make sure it doesn't get mutated for the test.
        const result = await tree.createFile(fileName, buf, Object.assign({}, fileInfo), { "m.new_content": true });
        expect(result).toMatchObject({ event_id: fileEventId });

        expect(uploadFn).toHaveBeenCalledTimes(1);
        expect(sendMsgFn).toHaveBeenCalledTimes(1);
        expect(sendStateFn).toHaveBeenCalledTimes(1);
    });

    it("should support getting files", () => {
        const fileEventId = "$file";
        const fileEvent = { forTest: true }; // MatrixEvent mock
        room.currentState = {
            getStateEvents: (eventType: string, stateKey?: string) => {
                expect(eventType).toEqual(UNSTABLE_MSC3089_BRANCH.unstable); // test to ensure we're definitely using unstable
                expect(stateKey).toEqual(fileEventId);
                return fileEvent;
            },
        };

        const file = tree.getFile(fileEventId);
        expect(file).toBeDefined();
        expect(file!.indexEvent).toBe(fileEvent);
    });

    it("should return falsy for unknown files", () => {
        const fileEventId = "$file";
        room.currentState = {
            getStateEvents: (eventType: string, stateKey?: string): MatrixEvent[] | MatrixEvent | null => {
                expect(eventType).toEqual(UNSTABLE_MSC3089_BRANCH.unstable); // test to ensure we're definitely using unstable
                expect(stateKey).toEqual(fileEventId);
                return null;
            },
        };

        const file = tree.getFile(fileEventId);
        expect(file).toBeFalsy();
    });

    it("should list files", () => {
        const firstFile = { getContent: () => ({ active: true }) };
        const secondFile = { getContent: () => ({ active: false }) }; // deliberately inactive
        room.currentState = {
            getStateEvents: (eventType: string, stateKey?: string) => {
                expect(eventType).toEqual(UNSTABLE_MSC3089_BRANCH.unstable); // test to ensure we're definitely using unstable
                expect(stateKey).toBeUndefined();
                return [firstFile, secondFile];
            },
        };

        const files = tree.listFiles();
        expect(files).toBeDefined();
        expect(files.length).toEqual(1);
        expect(files[0].indexEvent).toBe(firstFile);
    });

    it("should list all files", () => {
        const firstFile = { getContent: () => ({ active: true }) };
        const secondFile = { getContent: () => ({ active: false }) }; // deliberately inactive
        room.currentState = {
            getStateEvents: (eventType: string, stateKey?: string) => {
                expect(eventType).toEqual(UNSTABLE_MSC3089_BRANCH.unstable); // test to ensure we're definitely using unstable
                expect(stateKey).toBeUndefined();
                return [firstFile, secondFile];
            },
        };

        const files = tree.listAllFiles();
        expect(files).toBeDefined();
        expect(files.length).toEqual(2);
        expect(files[0].indexEvent).toBe(firstFile);
        expect(files[1].indexEvent).toBe(secondFile);
    });
});
