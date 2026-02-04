/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, PendingEventOrdering, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { mocked } from "jest-mock";
import { act, waitFor } from "jest-matrix-react";

import Modal, { type ComponentType, type IHandle } from "../../src/Modal";
import WidgetUtils from "../../src/utils/WidgetUtils";
import { WidgetType } from "../../src/widgets/WidgetType";
import { warnSelfDemote } from "../../src/components/views/right_panel/UserInfo";
import dispatcher from "../../src/dispatcher/dispatcher";
import QuestionDialog from "../../src/components/views/dialogs/QuestionDialog";
import ErrorDialog from "../../src/components/views/dialogs/ErrorDialog";
import { setUpCommandTest } from "./slash-commands/utils";
import { type Command } from "../../src/slash-commands/command";

jest.mock("../../src/components/views/right_panel/UserInfo");

describe("SlashCommands", () => {
    const roomId = "!room:example.com";

    describe("/topic", () => {
        it("sets topic", async () => {
            const { client, command, args } = setUpCommandTest(roomId, "/topic pizza");
            expect(args).toBeDefined();

            command.run(client, "room-id", null, args);

            expect(client.setRoomTopic).toHaveBeenCalledWith("room-id", "pizza", undefined);
        });

        it("should show topic modal if no args passed", async () => {
            const spy = jest.spyOn(Modal, "createDialog");
            const { client, command } = setUpCommandTest(roomId, "/topic");
            await command.run(client, roomId, null).promise;
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
        describe("isEnabled", () => {
            it("should return true for Room", () => {
                const { client, command } = setUpCommandTest(roomId, `/${commandName}`);
                expect(command.isEnabled(client, roomId)).toBe(true);
            });

            it("should return false for LocalRoom", () => {
                const { client, command } = setUpCommandTest(roomId, `/${commandName}`, true);
                expect(command.isEnabled(client, roomId)).toBe(false);
            });
        });
    });

    describe("/op", () => {
        it("should return usage if no args", () => {
            const { client, command, args } = setUpCommandTest(roomId, "/op");
            expect(command.run(client, roomId, null, args).error).toBe(command.getUsage());
        });

        it("should reject with usage if given an invalid power level value", () => {
            const { client, command, args } = setUpCommandTest(roomId, "/op @bob:server Admin");
            expect(command.run(client, roomId, null, args).error).toBe(command.getUsage());
        });

        it("should reject with usage for invalid input", () => {
            const { client, command } = setUpCommandTest(roomId, "/op");
            expect(command.run(client, roomId, null, " ").error).toBe(command.getUsage());
        });

        it("should warn about self demotion", async () => {
            const { client, command, room } = setUpCommandTest(roomId, "/op");
            const member = new RoomMember(roomId, client.getSafeUserId());
            member.membership = KnownMembership.Join;
            member.powerLevel = 100;
            room.getMember = () => member;
            command.run(client, roomId, null, `${client.getUserId()} 0`);
            expect(warnSelfDemote).toHaveBeenCalled();
        });

        it("should default to 50 if no powerlevel specified", async () => {
            const { client, command, room } = setUpCommandTest(roomId, "/op");
            const member = new RoomMember(roomId, "@user:server");
            member.membership = KnownMembership.Join;
            room.getMember = () => member;
            command.run(client, roomId, null, member.userId);
            expect(client.setPowerLevel).toHaveBeenCalledWith(roomId, member.userId, 50);
        });
    });

    describe("/deop", () => {
        it("should return usage if no args", () => {
            const { client, command } = setUpCommandTest(roomId, "/deop");
            expect(command.run(client, roomId, null, undefined).error).toBe(command.getUsage());
        });

        it("should warn about self demotion", async () => {
            const { client, command, room } = setUpCommandTest(roomId, "/deop");
            const member = new RoomMember(roomId, client.getSafeUserId());
            member.membership = KnownMembership.Join;
            member.powerLevel = 100;
            room.getMember = () => member;
            await command.run(client, roomId, null, client.getSafeUserId()).promise;
            expect(warnSelfDemote).toHaveBeenCalled();
        });

        it("should reject with usage for invalid input", () => {
            const { client, command } = setUpCommandTest(roomId, "/deop");
            expect(command.run(client, roomId, null, " ").error).toBe(command.getUsage());
        });
    });

    describe("/part", () => {
        function setUp(): {
            client: MatrixClient;
            command: Command;
            args?: string;
            room1: Room;
            room2: Room;
        } {
            const spy = jest.spyOn(Modal, "createDialog");
            spy.mockReturnValue({ close: () => {} } as unknown as IHandle<ComponentType>);

            const { client, command, args } = setUpCommandTest(roomId, "/part #foo:bar");
            expect(args).toBeDefined();

            const room1 = new Room("!room-id", client, client.getSafeUserId(), {
                pendingEventOrdering: PendingEventOrdering.Detached,
            });

            const room2 = new Room("!other-room", client, client.getSafeUserId());

            mocked(client.getRoom).mockImplementation((rId: string): Room | null => {
                if (rId === room1.roomId) {
                    return room1;
                } else if (rId === room2.roomId) {
                    return room2;
                } else {
                    return null;
                }
            });
            mocked(client.getRooms).mockReturnValue([room1, room2]);

            return { client, command, args, room1, room2 };
        }

        it("should part room matching alias if found", async () => {
            const { client, command, args, room1, room2 } = setUp();
            room1.getCanonicalAlias = jest.fn().mockReturnValue("#foo:bar");
            room2.getCanonicalAlias = jest.fn().mockReturnValue("#baz:bar");

            await command.run(client, room1.roomId, null, args).promise;

            expect(client.leaveRoomChain).toHaveBeenCalledWith(room1.roomId, expect.anything());
        });

        it("should part room matching alt alias if found", async () => {
            const { client, command, args, room1, room2 } = setUp();
            room1.getAltAliases = jest.fn().mockReturnValue(["#foo:bar"]);
            room2.getAltAliases = jest.fn().mockReturnValue(["#baz:bar"]);

            await command.run(client, room1.roomId, null, args).promise;

            expect(client.leaveRoomChain).toHaveBeenCalledWith(room1.roomId, expect.anything());
        });
    });

    describe.each(["rainbow", "rainbowme"])("/%s", (commandName: string) => {
        it("should return usage if no args", () => {
            const { client, command } = setUpCommandTest(roomId, `/${commandName}`);
            expect(command.run(client, roomId, null, undefined).error).toBe(command.getUsage());
        });

        it("should make things rainbowy", async () => {
            const { client, command } = setUpCommandTest(roomId, `/${commandName}`);

            await expect(
                command.run(client, roomId, null, "this is a test message").promise,
            ).resolves.toMatchSnapshot();
        });
    });

    describe.each(["shrug", "tableflip", "unflip", "lenny"])("/%s", (commandName: string) => {
        it("should match snapshot with no args", async () => {
            const { client, command } = setUpCommandTest(roomId, `/${commandName}`);
            await expect(command.run(client, roomId, null).promise).resolves.toMatchSnapshot();
        });

        it("should match snapshot with args", async () => {
            const { client, command } = setUpCommandTest(roomId, `/${commandName}`);

            await expect(
                command.run(client, roomId, null, "this is a test message").promise,
            ).resolves.toMatchSnapshot();
        });
    });

    describe("/verify", () => {
        it("should return usage if no args", () => {
            const { client, command } = setUpCommandTest(roomId, `/verify`);
            expect(command.run(client, roomId, null, undefined).error).toBe(command.getUsage());
        });

        it("should attempt manual verification after confirmation", async () => {
            // Given we say yes to prompt
            const spy = jest.spyOn(Modal, "createDialog");
            spy.mockReturnValue({ finished: Promise.resolve([true]) } as unknown as IHandle<ComponentType>);

            // When we run the command
            const { client, command } = setUpCommandTest(roomId, `/verify`);
            await act(() => command.run(client, roomId, null, "mydeviceid myfingerprint"));

            // Then the prompt is displayed
            expect(spy).toHaveBeenCalledWith(
                QuestionDialog,
                expect.objectContaining({ title: "Caution: manual device verification" }),
            );

            // And then we attempt the verification
            await waitFor(() =>
                expect(spy).toHaveBeenCalledWith(
                    ErrorDialog,
                    expect.objectContaining({ title: "Verification failed" }),
                ),
            );
        });

        it("should not do manual verification if cancelled", async () => {
            // Given we say no to prompt
            const spy = jest.spyOn(Modal, "createDialog");
            spy.mockReturnValue({ finished: Promise.resolve([false]) } as unknown as IHandle<ComponentType>);

            // When we run the command
            const { client, command } = setUpCommandTest(roomId, `/verify`);
            command.run(client, roomId, null, "mydeviceid myfingerprint");

            // Then the prompt is displayed
            expect(spy).toHaveBeenCalledWith(
                QuestionDialog,
                expect.objectContaining({ title: "Caution: manual device verification" }),
            );

            // But nothing else happens
            expect(spy).not.toHaveBeenCalledWith(ErrorDialog, expect.anything());
        });
    });

    describe("/addwidget", () => {
        it("should parse html iframe snippets", async () => {
            jest.spyOn(WidgetUtils, "canUserModifyWidgets").mockReturnValue(true);
            const spy = jest.spyOn(WidgetUtils, "setRoomWidget");

            const { client, command } = setUpCommandTest(roomId, `/addwidget`);

            command.run(client, roomId, null, '<iframe src="https://element.io"></iframe>');

            await waitFor(() =>
                expect(spy).toHaveBeenCalledWith(
                    client,
                    roomId,
                    expect.any(String),
                    WidgetType.CUSTOM,
                    "https://element.io",
                    "Custom",
                    {},
                ),
            );
        });
    });

    describe("/join", () => {
        it("should return usage if no args", () => {
            const { client, command } = setUpCommandTest(roomId, `/join`);
            expect(command.run(client, roomId, null, undefined).error).toBe(command.getUsage());
        });

        it("should handle matrix.org permalinks", async () => {
            const { client, command } = setUpCommandTest(roomId, `/join`);
            jest.spyOn(dispatcher, "dispatch");

            await command.run(client, roomId, null, "https://matrix.to/#/!roomId:server/$eventId").promise;

            expect(dispatcher.dispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: "view_room",
                    room_id: "!roomId:server",
                    event_id: "$eventId",
                    highlighted: true,
                }),
            );
        });

        it("should handle room aliases", async () => {
            const { client, command } = setUpCommandTest(roomId, `/join`);
            jest.spyOn(dispatcher, "dispatch");

            await command.run(client, roomId, null, "#test:server").promise;

            expect(dispatcher.dispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: "view_room",
                    room_alias: "#test:server",
                }),
            );
        });

        it("should handle room aliases with no server component", async () => {
            const { client, command } = setUpCommandTest(roomId, `/join`);
            jest.spyOn(dispatcher, "dispatch");

            await command.run(client, roomId, null, "#test").promise;

            expect(dispatcher.dispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: "view_room",
                    room_alias: `#test:${client.getDomain()}`,
                }),
            );
        });

        it("should handle room IDs and via servers", async () => {
            const { client, command } = setUpCommandTest(roomId, `/join`);
            jest.spyOn(dispatcher, "dispatch");

            await command.run(client, roomId, null, "!foo:bar serv1.com serv2.com").promise;

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
