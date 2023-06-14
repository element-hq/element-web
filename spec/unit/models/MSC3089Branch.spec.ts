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

import { IContent, MatrixClient, MatrixEvent } from "../../../src";
import { Room } from "../../../src/models/room";
import { IEncryptedFile, RelationType, UNSTABLE_MSC3089_BRANCH } from "../../../src/@types/event";
import { EventTimelineSet } from "../../../src/models/event-timeline-set";
import { EventTimeline } from "../../../src/models/event-timeline";
import { MSC3089Branch } from "../../../src/models/MSC3089Branch";
import { MSC3089TreeSpace } from "../../../src/models/MSC3089TreeSpace";

describe("MSC3089Branch", () => {
    let client: MatrixClient;
    // @ts-ignore - TS doesn't know that this is a type
    let indexEvent: any;
    let directory: MSC3089TreeSpace;
    let branch: MSC3089Branch;
    let branch2: MSC3089Branch;

    const branchRoomId = "!room:example.org";
    const fileEventId = "$file";
    const fileEventId2 = "$second_file";

    const staticTimelineSets = {} as EventTimelineSet;
    const staticRoom = {
        getUnfilteredTimelineSet: () => staticTimelineSets,
    } as any as Room; // partial

    beforeEach(() => {
        // TODO: Use utility functions to create test rooms and clients
        client = <MatrixClient>{
            getRoom: (roomId: string) => {
                if (roomId === branchRoomId) {
                    return staticRoom;
                } else {
                    throw new Error("Unexpected fetch for unknown room");
                }
            },
        };
        indexEvent = {
            getRoomId: () => branchRoomId,
            getStateKey: () => fileEventId,
        };
        directory = new MSC3089TreeSpace(client, branchRoomId);
        branch = new MSC3089Branch(client, indexEvent, directory);
        branch2 = new MSC3089Branch(
            client,
            {
                getRoomId: () => branchRoomId,
                getStateKey: () => fileEventId2,
            } as MatrixEvent,
            directory,
        );
    });

    it("should know the file event ID", () => {
        expect(branch.id).toEqual(fileEventId);
    });

    it("should know if the file is active or not", () => {
        indexEvent.getContent = () => ({});
        expect(branch.isActive).toBe(false);
        indexEvent.getContent = () => ({ active: false });
        expect(branch.isActive).toBe(false);
        indexEvent.getContent = () => ({ active: true });
        expect(branch.isActive).toBe(true);
        indexEvent.getContent = () => ({ active: "true" }); // invalid boolean, inactive
        expect(branch.isActive).toBe(false);
    });

    it("should be able to delete the file", async () => {
        const eventIdOrder = [fileEventId, fileEventId2];

        const stateFn = jest
            .fn()
            .mockImplementation((roomId: string, eventType: string, content: any, stateKey: string) => {
                expect(roomId).toEqual(branchRoomId);
                expect(eventType).toEqual(UNSTABLE_MSC3089_BRANCH.unstable); // test that we're definitely using the unstable value
                expect(content).toMatchObject({});
                expect(content["active"]).toBeUndefined();
                expect(stateKey).toEqual(eventIdOrder[stateFn.mock.calls.length - 1]);

                return Promise.resolve(); // return value not used
            });
        client.sendStateEvent = stateFn;

        const redactFn = jest.fn().mockImplementation((roomId: string, eventId: string) => {
            expect(roomId).toEqual(branchRoomId);
            expect(eventId).toEqual(eventIdOrder[stateFn.mock.calls.length - 1]);

            return Promise.resolve(); // return value not used
        });
        client.redactEvent = redactFn;

        branch.getVersionHistory = () => Promise.resolve([branch, branch2]);
        branch2.getVersionHistory = () => Promise.resolve([branch2]);

        await branch.delete();

        expect(stateFn).toHaveBeenCalledTimes(2);
        expect(redactFn).toHaveBeenCalledTimes(2);
    });

    it("should know its name", async () => {
        const name = "My File.txt";
        indexEvent.getContent = () => ({ active: true, name: name });

        const res = branch.getName();

        expect(res).toEqual(name);
    });

    it("should be able to change its name", async () => {
        const name = "My File.txt";
        indexEvent.getContent = () => ({ active: true, retained: true });
        const stateFn = jest
            .fn()
            .mockImplementation((roomId: string, eventType: string, content: any, stateKey: string) => {
                expect(roomId).toEqual(branchRoomId);
                expect(eventType).toEqual(UNSTABLE_MSC3089_BRANCH.unstable); // test that we're definitely using the unstable value
                expect(content).toMatchObject({
                    retained: true, // canary for copying state
                    active: true,
                    name: name,
                });
                expect(stateKey).toEqual(fileEventId);

                return Promise.resolve(); // return value not used
            });
        client.sendStateEvent = stateFn;

        await branch.setName(name);

        expect(stateFn).toHaveBeenCalledTimes(1);
    });

    it("should be v1 by default", () => {
        indexEvent.getContent = () => ({ active: true });

        const res = branch.version;

        expect(res).toEqual(1);
    });

    it("should be vN when set", () => {
        indexEvent.getContent = () => ({ active: true, version: 3 });

        const res = branch.version;

        expect(res).toEqual(3);
    });

    it("should be unlocked by default", async () => {
        indexEvent.getContent = () => ({ active: true });

        const res = branch.isLocked();

        expect(res).toEqual(false);
    });

    it("should use lock status from index event", async () => {
        indexEvent.getContent = () => ({ active: true, locked: true });

        const res = branch.isLocked();

        expect(res).toEqual(true);
    });

    it("should be able to change its locked status", async () => {
        const locked = true;
        indexEvent.getContent = () => ({ active: true, retained: true });
        const stateFn = jest
            .fn()
            .mockImplementation((roomId: string, eventType: string, content: any, stateKey: string) => {
                expect(roomId).toEqual(branchRoomId);
                expect(eventType).toEqual(UNSTABLE_MSC3089_BRANCH.unstable); // test that we're definitely using the unstable value
                expect(content).toMatchObject({
                    retained: true, // canary for copying state
                    active: true,
                    locked: locked,
                });
                expect(stateKey).toEqual(fileEventId);

                return Promise.resolve(); // return value not used
            });
        client.sendStateEvent = stateFn;

        await branch.setLocked(locked);

        expect(stateFn).toHaveBeenCalledTimes(1);
    });

    it("should be able to return event information", async () => {
        const mxcLatter = "example.org/file";
        const fileContent = { isFile: "not quite", url: "mxc://" + mxcLatter };
        const fileEvent = { getId: () => fileEventId, getOriginalContent: () => ({ file: fileContent }) };
        staticRoom.getUnfilteredTimelineSet = () =>
            ({
                findEventById: (eventId) => {
                    expect(eventId).toEqual(fileEventId);
                    return fileEvent;
                },
            } as EventTimelineSet);
        client.mxcUrlToHttp = (mxc: string) => {
            expect(mxc).toEqual("mxc://" + mxcLatter);
            return `https://example.org/_matrix/media/v1/download/${mxcLatter}`;
        };
        client.decryptEventIfNeeded = () => Promise.resolve();

        const res = await branch.getFileInfo();
        expect(res).toBeDefined();
        expect(res).toMatchObject({
            info: fileContent,
            // Escape regex from MDN guides: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
            httpUrl: expect.stringMatching(`.+${mxcLatter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
        });
    });

    it("should be able to return the event object", async () => {
        const mxcLatter = "example.org/file";
        const fileContent = { isFile: "not quite", url: "mxc://" + mxcLatter };
        const fileEvent = { getId: () => fileEventId, getOriginalContent: () => ({ file: fileContent }) };
        staticRoom.getUnfilteredTimelineSet = () =>
            ({
                findEventById: (eventId) => {
                    expect(eventId).toEqual(fileEventId);
                    return fileEvent;
                },
            } as EventTimelineSet);
        client.mxcUrlToHttp = (mxc: string) => {
            expect(mxc).toEqual("mxc://" + mxcLatter);
            return `https://example.org/_matrix/media/v1/download/${mxcLatter}`;
        };
        client.decryptEventIfNeeded = () => Promise.resolve();

        const res = await branch.getFileEvent();
        expect(res).toBeDefined();
        expect(res).toBe(fileEvent);
    });

    it("should create new versions of itself", async () => {
        const canaryName = "canary";
        const canaryContents = "contents go here";
        const canaryFile = {} as IEncryptedFile;
        const canaryAddl = { canary: true };
        indexEvent.getContent = () => ({ active: true, retained: true });
        const stateKeyOrder = [fileEventId2, fileEventId];
        const stateFn = jest
            .fn()
            .mockImplementation((roomId: string, eventType: string, content: any, stateKey: string) => {
                expect(roomId).toEqual(branchRoomId);
                expect(eventType).toEqual(UNSTABLE_MSC3089_BRANCH.unstable); // test that we're definitely using the unstable value
                expect(stateKey).toEqual(stateKeyOrder[stateFn.mock.calls.length - 1]);
                if (stateKey === fileEventId) {
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(content).toMatchObject({
                        retained: true, // canary for copying state
                        active: false,
                    });
                } else if (stateKey === fileEventId2) {
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(content).toMatchObject({
                        active: true,
                        version: 2,
                        name: canaryName,
                    });
                } else {
                    throw new Error("Unexpected state key: " + stateKey);
                }

                return Promise.resolve(); // return value not used
            });
        client.sendStateEvent = stateFn;

        const createFn = jest
            .fn()
            .mockImplementation(
                (name: string, contents: ArrayBuffer, info: Partial<IEncryptedFile>, addl: IContent) => {
                    expect(name).toEqual(canaryName);
                    expect(contents).toBe(canaryContents);
                    expect(info).toBe(canaryFile);
                    expect(addl).toMatchObject({
                        ...canaryAddl,
                        "m.new_content": true,
                        "m.relates_to": {
                            rel_type: RelationType.Replace,
                            event_id: fileEventId,
                        },
                    });

                    return Promise.resolve({ event_id: fileEventId2 });
                },
            );
        directory.createFile = createFn;

        await branch.createNewVersion(canaryName, canaryContents, canaryFile, canaryAddl);

        expect(stateFn).toHaveBeenCalledTimes(2);
        expect(createFn).toHaveBeenCalledTimes(1);
    });

    it("should fetch file history", async () => {
        branch2.getFileEvent = () =>
            Promise.resolve({
                replacingEventId: () => undefined,
                getId: () => fileEventId2,
            } as MatrixEvent);
        branch.getFileEvent = () =>
            Promise.resolve({
                replacingEventId: () => fileEventId2,
                getId: () => fileEventId,
            } as MatrixEvent);

        const events = [
            await branch.getFileEvent(),
            await branch2.getFileEvent(),
            {
                replacingEventId: (): string | undefined => undefined,
                getId: () => "$unknown",
            },
        ];
        staticRoom.getLiveTimeline = () => ({ getEvents: () => events } as EventTimeline);

        directory.getFile = (evId: string) => {
            expect(evId).toEqual(fileEventId);
            return branch;
        };

        const results = await branch2.getVersionHistory();
        expect(results).toMatchObject([branch2, branch]);
    });
});
