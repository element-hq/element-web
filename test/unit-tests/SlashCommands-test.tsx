/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { mocked } from "jest-mock";

import { type Command, Commands, getCommand } from "../../src/SlashCommands";
import { createTestClient } from "../test-utils";
import { LocalRoom, LOCAL_ROOM_ID_PREFIX } from "../../src/models/LocalRoom";
import SettingsStore from "../../src/settings/SettingsStore";
import LegacyCallHandler from "../../src/LegacyCallHandler";
import { SdkContextClass } from "../../src/contexts/SDKContext";
import Modal from "../../src/Modal";
import WidgetUtils from "../../src/utils/WidgetUtils";
import { WidgetType } from "../../src/widgets/WidgetType";
import { warnSelfDemote } from "../../src/components/views/right_panel/UserInfo";
import dispatcher from "../../src/dispatcher/dispatcher";
import { SettingLevel } from "../../src/settings/SettingLevel";

jest.mock("../../src/components/views/right_panel/UserInfo");

describe("SlashCommands", () => {
    let client: MatrixClient;
    const roomId = "!room:example.com";
    let room: Room;
    const localRoomId = LOCAL_ROOM_ID_PREFIX + "test";
    let localRoom: LocalRoom;
    let command: Command;

    const findCommand = (cmd: string): Command | undefined => {
        return Commands.find((command: Command) => command.command === cmd);
    };

    const setCurrentRoom = (): void => {
        mocked(SdkContextClass.instance.roomViewStore.getRoomId).mockReturnValue(roomId);
        mocked(client.getRoom).mockImplementation((rId: string): Room | null => {
            if (rId === roomId) return room;
            return null;
        });
    };

    const setCurrentLocalRoom = (): void => {
        mocked(SdkContextClass.instance.roomViewStore.getRoomId).mockReturnValue(localRoomId);
        mocked(client.getRoom).mockImplementation((rId: string): Room | null => {
            if (rId === localRoomId) return localRoom;
            return null;
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();

        client = createTestClient();

        room = new Room(roomId, client, client.getSafeUserId());
        localRoom = new LocalRoom(localRoomId, client, client.getSafeUserId());

        jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId");
    });

    describe("/topic", () => {
        it("sets topic", async () => {
            const command = getCommand("/topic pizza");
            expect(command.cmd).toBeDefined();
            expect(command.args).toBeDefined();
            await command.cmd!.run(client, "room-id", null, command.args);
            expect(client.setRoomTopic).toHaveBeenCalledWith("room-id", "pizza", undefined);
        });

        it("should show topic modal if no args passed", async () => {
            const spy = jest.spyOn(Modal, "createDialog");
            const command = getCommand("/topic")!;
            await command.cmd!.run(client, roomId, null);
            expect(spy).toHaveBeenCalled();
        });
    });

    describe.each([
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
            command = findCommand(commandName)!;
        });

        describe("isEnabled", () => {
            it("should return true for Room", () => {
                setCurrentRoom();
                expect(command.isEnabled(client)).toBe(true);
            });

            it("should return false for LocalRoom", () => {
                setCurrentLocalRoom();
                expect(command.isEnabled(client)).toBe(false);
            });
        });
    });

    describe("/upgraderoom", () => {
        beforeEach(() => {
            command = findCommand("upgraderoom")!;
            setCurrentRoom();
        });

        it("should be disabled by default", () => {
            expect(command.isEnabled(client)).toBe(false);
        });

        it("should be enabled for developerMode", () => {
            SettingsStore.setValue("developerMode", null, SettingLevel.DEVICE, true);
            expect(command.isEnabled(client)).toBe(true);
        });
    });

    describe("/op", () => {
        beforeEach(() => {
            command = findCommand("op")!;
        });

        it("should return usage if no args", () => {
            expect(command.run(client, roomId, null, undefined).error).toBe(command.getUsage());
        });

        it("should reject with usage if given an invalid power level value", () => {
            expect(command.run(client, roomId, null, "@bob:server Admin").error).toBe(command.getUsage());
        });

        it("should reject with usage for invalid input", () => {
            expect(command.run(client, roomId, null, " ").error).toBe(command.getUsage());
        });

        it("should warn about self demotion", async () => {
            setCurrentRoom();
            const member = new RoomMember(roomId, client.getSafeUserId());
            member.membership = KnownMembership.Join;
            member.powerLevel = 100;
            room.getMember = () => member;
            command.run(client, roomId, null, `${client.getUserId()} 0`);
            expect(warnSelfDemote).toHaveBeenCalled();
        });

        it("should default to 50 if no powerlevel specified", async () => {
            setCurrentRoom();
            const member = new RoomMember(roomId, "@user:server");
            member.membership = KnownMembership.Join;
            room.getMember = () => member;
            command.run(client, roomId, null, member.userId);
            expect(client.setPowerLevel).toHaveBeenCalledWith(roomId, member.userId, 50);
        });
    });

    describe("/deop", () => {
        beforeEach(() => {
            command = findCommand("deop")!;
        });

        it("should return usage if no args", () => {
            expect(command.run(client, roomId, null, undefined).error).toBe(command.getUsage());
        });

        it("should warn about self demotion", async () => {
            setCurrentRoom();
            const member = new RoomMember(roomId, client.getSafeUserId());
            member.membership = KnownMembership.Join;
            member.powerLevel = 100;
            room.getMember = () => member;
            command.run(client, roomId, null, client.getSafeUserId());
            expect(warnSelfDemote).toHaveBeenCalled();
        });

        it("should reject with usage for invalid input", () => {
            expect(command.run(client, roomId, null, " ").error).toBe(command.getUsage());
        });
    });

    describe("/tovirtual", () => {
        beforeEach(() => {
            command = findCommand("tovirtual")!;
        });

        describe("isEnabled", () => {
            describe("when virtual rooms are supported", () => {
                beforeEach(() => {
                    jest.spyOn(LegacyCallHandler.instance, "getSupportsVirtualRooms").mockReturnValue(true);
                });

                it("should return true for Room", () => {
                    setCurrentRoom();
                    expect(command.isEnabled(client)).toBe(true);
                });

                it("should return false for LocalRoom", () => {
                    setCurrentLocalRoom();
                    expect(command.isEnabled(client)).toBe(false);
                });
            });

            describe("when virtual rooms are not supported", () => {
                beforeEach(() => {
                    jest.spyOn(LegacyCallHandler.instance, "getSupportsVirtualRooms").mockReturnValue(false);
                });

                it("should return false for Room", () => {
                    setCurrentRoom();
                    expect(command.isEnabled(client)).toBe(false);
                });

                it("should return false for LocalRoom", () => {
                    setCurrentLocalRoom();
                    expect(command.isEnabled(client)).toBe(false);
                });
            });
        });
    });

    describe("/part", () => {
        it("should part room matching alias if found", async () => {
            const room1 = new Room("room-id", client, client.getSafeUserId());
            room1.getCanonicalAlias = jest.fn().mockReturnValue("#foo:bar");
            const room2 = new Room("other-room", client, client.getSafeUserId());
            room2.getCanonicalAlias = jest.fn().mockReturnValue("#baz:bar");
            mocked(client.getRooms).mockReturnValue([room1, room2]);

            const command = getCommand("/part #foo:bar");
            expect(command.cmd).toBeDefined();
            expect(command.args).toBeDefined();
            await command.cmd!.run(client, "room-id", null, command.args);
            expect(client.leaveRoomChain).toHaveBeenCalledWith("room-id", expect.anything());
        });

        it("should part room matching alt alias if found", async () => {
            const room1 = new Room("room-id", client, client.getSafeUserId());
            room1.getAltAliases = jest.fn().mockReturnValue(["#foo:bar"]);
            const room2 = new Room("other-room", client, client.getSafeUserId());
            room2.getAltAliases = jest.fn().mockReturnValue(["#baz:bar"]);
            mocked(client.getRooms).mockReturnValue([room1, room2]);

            const command = getCommand("/part #foo:bar");
            expect(command.cmd).toBeDefined();
            expect(command.args).toBeDefined();
            await command.cmd!.run(client, "room-id", null, command.args!);
            expect(client.leaveRoomChain).toHaveBeenCalledWith("room-id", expect.anything());
        });
    });

    describe.each(["rainbow", "rainbowme"])("/%s", (commandName: string) => {
        const command = findCommand(commandName)!;

        it("should return usage if no args", () => {
            expect(command.run(client, roomId, null, undefined).error).toBe(command.getUsage());
        });

        it("should make things rainbowy", () => {
            return expect(
                command.run(client, roomId, null, "this is a test message").promise,
            ).resolves.toMatchSnapshot();
        });
    });

    describe.each(["shrug", "tableflip", "unflip", "lenny"])("/%s", (commandName: string) => {
        const command = findCommand(commandName)!;

        it("should match snapshot with no args", () => {
            return expect(command.run(client, roomId, null).promise).resolves.toMatchSnapshot();
        });

        it("should match snapshot with args", () => {
            return expect(
                command.run(client, roomId, null, "this is a test message").promise,
            ).resolves.toMatchSnapshot();
        });
    });

    describe("/addwidget", () => {
        it("should parse html iframe snippets", async () => {
            jest.spyOn(WidgetUtils, "canUserModifyWidgets").mockReturnValue(true);
            const spy = jest.spyOn(WidgetUtils, "setRoomWidget");
            const command = findCommand("addwidget")!;
            await command.run(client, roomId, null, '<iframe src="https://element.io"></iframe>');
            expect(spy).toHaveBeenCalledWith(
                client,
                roomId,
                expect.any(String),
                WidgetType.CUSTOM,
                "https://element.io",
                "Custom",
                {},
            );
        });
    });

    describe("/join", () => {
        beforeEach(() => {
            jest.spyOn(dispatcher, "dispatch");
            command = findCommand(KnownMembership.Join)!;
        });

        it("should return usage if no args", () => {
            expect(command.run(client, roomId, null, undefined).error).toBe(command.getUsage());
        });

        it("should handle matrix.org permalinks", () => {
            command.run(client, roomId, null, "https://matrix.to/#/!roomId:server/$eventId");
            expect(dispatcher.dispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: "view_room",
                    room_id: "!roomId:server",
                    event_id: "$eventId",
                    highlighted: true,
                }),
            );
        });

        it("should handle room aliases", () => {
            command.run(client, roomId, null, "#test:server");
            expect(dispatcher.dispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: "view_room",
                    room_alias: "#test:server",
                }),
            );
        });

        it("should handle room aliases with no server component", () => {
            command.run(client, roomId, null, "#test");
            expect(dispatcher.dispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: "view_room",
                    room_alias: `#test:${client.getDomain()}`,
                }),
            );
        });

        it("should handle room IDs and via servers", () => {
            command.run(client, roomId, null, "!foo:bar serv1.com serv2.com");
            expect(dispatcher.dispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: "view_room",
                    room_id: "!foo:bar",
                    via_servers: ["serv1.com", "serv2.com"],
                }),
            );
        });
    });
});
