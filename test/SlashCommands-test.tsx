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

import { MatrixClient, Room } from 'matrix-js-sdk/src/matrix';
import { mocked } from 'jest-mock';

import { Command, Commands, getCommand } from '../src/SlashCommands';
import { createTestClient } from './test-utils';
import { MatrixClientPeg } from '../src/MatrixClientPeg';
import { LocalRoom, LOCAL_ROOM_ID_PREFIX } from '../src/models/LocalRoom';
import SettingsStore from '../src/settings/SettingsStore';
import LegacyCallHandler from '../src/LegacyCallHandler';
import { SdkContextClass } from '../src/contexts/SDKContext';

describe('SlashCommands', () => {
    let client: MatrixClient;
    const roomId = "!room:example.com";
    let room: Room;
    const localRoomId = LOCAL_ROOM_ID_PREFIX + "test";
    let localRoom: LocalRoom;
    let command: Command;

    const findCommand = (cmd: string): Command => {
        return Commands.find((command: Command) => command.command === cmd);
    };

    const setCurrentRoom = (): void => {
        mocked(SdkContextClass.instance.roomViewStore.getRoomId).mockReturnValue(roomId);
        mocked(client.getRoom).mockImplementation((rId: string): Room => {
            if (rId === roomId) return room;
        });
    };

    const setCurrentLocalRoon = (): void => {
        mocked(SdkContextClass.instance.roomViewStore.getRoomId).mockReturnValue(localRoomId);
        mocked(client.getRoom).mockImplementation((rId: string): Room => {
            if (rId === localRoomId) return localRoom;
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();

        client = createTestClient();
        jest.spyOn(MatrixClientPeg, 'get').mockReturnValue(client);

        room = new Room(roomId, client, client.getUserId());
        localRoom = new LocalRoom(localRoomId, client, client.getUserId());

        jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId");
    });

    describe('/topic', () => {
        it('sets topic', async () => {
            const command = getCommand("/topic pizza");
            expect(command.cmd).toBeDefined();
            expect(command.args).toBeDefined();
            await command.cmd.run("room-id", null, command.args);
            expect(client.setRoomTopic).toHaveBeenCalledWith("room-id", "pizza", undefined);
        });
    });

    describe.each([
        ["upgraderoom"],
        ["myroomnick"],
        ["roomavatar"],
        ["myroomavatar"],
        ["topic"],
        ["roomname"],
        ["invite"],
        ["part"],
        ["remove"],
        ["ban"],
        ["unban"],
        ["op"],
        ["deop"],
        ["addwidget"],
        ["discardsession"],
        ["whois"],
        ["holdcall"],
        ["unholdcall"],
        ["converttodm"],
        ["converttoroom"],
    ])("/%s", (commandName: string) => {
        beforeEach(() => {
            command = findCommand(commandName);
        });

        describe("isEnabled", () => {
            it("should return true for Room", () => {
                setCurrentRoom();
                expect(command.isEnabled()).toBe(true);
            });

            it("should return false for LocalRoom", () => {
                setCurrentLocalRoon();
                expect(command.isEnabled()).toBe(false);
            });
        });
    });

    describe("/tovirtual", () => {
        beforeEach(() => {
            command = findCommand("tovirtual");
        });

        describe("isEnabled", () => {
            describe("when virtual rooms are supported", () => {
                beforeEach(() => {
                    jest.spyOn(LegacyCallHandler.instance, "getSupportsVirtualRooms").mockReturnValue(true);
                });

                it("should return true for Room", () => {
                    setCurrentRoom();
                    expect(command.isEnabled()).toBe(true);
                });

                it("should return false for LocalRoom", () => {
                    setCurrentLocalRoon();
                    expect(command.isEnabled()).toBe(false);
                });
            });

            describe("when virtual rooms are not supported", () => {
                beforeEach(() => {
                    jest.spyOn(LegacyCallHandler.instance, "getSupportsVirtualRooms").mockReturnValue(false);
                });

                it("should return false for Room", () => {
                    setCurrentRoom();
                    expect(command.isEnabled()).toBe(false);
                });

                it("should return false for LocalRoom", () => {
                    setCurrentLocalRoon();
                    expect(command.isEnabled()).toBe(false);
                });
            });
        });
    });

    describe("/remakeolm", () => {
        beforeEach(() => {
            command = findCommand("remakeolm");
        });

        describe("isEnabled", () => {
            describe("when developer mode is enabled", () => {
                beforeEach(() => {
                    jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                        if (settingName === "developerMode") return true;
                    });
                });

                it("should return true for Room", () => {
                    setCurrentRoom();
                    expect(command.isEnabled()).toBe(true);
                });

                it("should return false for LocalRoom", () => {
                    setCurrentLocalRoon();
                    expect(command.isEnabled()).toBe(false);
                });
            });

            describe("when developer mode is not enabled", () => {
                beforeEach(() => {
                    jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName: string) => {
                        if (settingName === "developerMode") return false;
                    });
                });

                it("should return false for Room", () => {
                    setCurrentRoom();
                    expect(command.isEnabled()).toBe(false);
                });

                it("should return false for LocalRoom", () => {
                    setCurrentLocalRoon();
                    expect(command.isEnabled()).toBe(false);
                });
            });
        });
    });

    describe("/part", () => {
        it("should part room matching alias if found", async () => {
            const room1 = new Room("room-id", client, client.getUserId());
            room1.getCanonicalAlias = jest.fn().mockReturnValue("#foo:bar");
            const room2 = new Room("other-room", client, client.getUserId());
            room2.getCanonicalAlias = jest.fn().mockReturnValue("#baz:bar");
            mocked(client.getRooms).mockReturnValue([room1, room2]);

            const command = getCommand("/part #foo:bar");
            expect(command.cmd).toBeDefined();
            expect(command.args).toBeDefined();
            await command.cmd.run("room-id", null, command.args);
            expect(client.leaveRoomChain).toHaveBeenCalledWith("room-id", expect.anything());
        });

        it("should part room matching alt alias if found", async () => {
            const room1 = new Room("room-id", client, client.getUserId());
            room1.getAltAliases = jest.fn().mockReturnValue(["#foo:bar"]);
            const room2 = new Room("other-room", client, client.getUserId());
            room2.getAltAliases = jest.fn().mockReturnValue(["#baz:bar"]);
            mocked(client.getRooms).mockReturnValue([room1, room2]);

            const command = getCommand("/part #foo:bar");
            expect(command.cmd).toBeDefined();
            expect(command.args).toBeDefined();
            await command.cmd.run("room-id", null, command.args);
            expect(client.leaveRoomChain).toHaveBeenCalledWith("room-id", expect.anything());
        });
    });
});
