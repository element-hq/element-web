/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 * Copyright 2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import RoomUpgradeWarningDialog, {
    type IFinishedOpts,
} from "../../../src/components/views/dialogs/RoomUpgradeWarningDialog";
import { type Command } from "../../../src/slash-commands/SlashCommands";
import { parseUpgradeRoomArgs } from "../../../src/slash-commands/upgraderoom/parseUpgradeRoomArgs";
import Modal from "../../../src/Modal";
import { setUpCommandTest } from "./utils";

describe("/upgraderoom", () => {
    const roomId = "!room:example.com";

    /**
     * Set up an upgraderoom test.
     *
     * @param continueUpgrade if true, simulates the user clicking Continue in
     *                        the "Upgrade Room" dialog. If false, simulates the
     *                        user clicking Cancel.
     */
    function setUp(continueUpgrade: boolean): {
        command: Command;
        client: MatrixClient;
        createDialog: unknown;
        upgradeRoom: unknown;
    } {
        jest.clearAllMocks();

        const { command, client } = setUpCommandTest(roomId, "/upgraderoom");

        const createDialog = jest.spyOn(Modal, "createDialog");
        const upgradeRoom = jest.fn().mockResolvedValue({ replacement_room: "!newroom" });
        const resp: IFinishedOpts = { continue: continueUpgrade, invite: false };
        createDialog.mockReturnValue({
            finished: Promise.resolve([resp]),
            close: jest.fn(),
        });
        client.upgradeRoom = upgradeRoom;

        return { command, client, createDialog, upgradeRoom };
    }

    it("should be enabled by default", () => {
        const { command, client } = setUp(false);
        expect(command.isEnabled(client, roomId)).toBe(true);
    });

    it("should return usage if given no args", () => {
        const { command, client } = setUp(false);

        expect(command.run(client, roomId, null, undefined).error).toBe(command.getUsage());
        expect(command.run(client, roomId, null, "").error).toBe(command.getUsage());
        expect(command.run(client, roomId, null, " ").error).toBe(command.getUsage());
    });

    it("should accept arguments of a room version with no additional creators", () => {
        expect(parseUpgradeRoomArgs("12")).toEqual({ targetVersion: "12" });
    });

    it("should accept arguments of a room version and additional creators", () => {
        expect(parseUpgradeRoomArgs("13 @u:s.co")).toEqual({
            targetVersion: "13",
            additionalCreators: ["@u:s.co"],
        });

        expect(parseUpgradeRoomArgs("14  @u:s.co @v:s.co  @w:z.uk")).toEqual({
            targetVersion: "14",
            additionalCreators: ["@u:s.co", "@v:s.co", "@w:z.uk"],
        });
    });

    it("should upgrade the room when given valid arguments", async () => {
        // Given the user clicks continue in the Upgrade Room dialog
        const { command, client, createDialog, upgradeRoom } = setUp(true);

        // When we type /upgraderoom ...
        const result = command.run(client, roomId, null, "12 @foo:bar.com @baz:qux.uk");
        expect(result.promise).toBeDefined();
        await result.promise;

        // Then we warned the user
        expect(createDialog).toHaveBeenCalledWith(
            RoomUpgradeWarningDialog,
            { roomId: "!room:example.com", targetVersion: "12" },
            undefined,
            false,
            true,
        );

        // And when they said yes, we called into upgradeRoom
        expect(upgradeRoom).toHaveBeenCalledWith("!room:example.com", "12", ["@foo:bar.com", "@baz:qux.uk"]);
    });

    it("should not upgrade the room if the user changes their mind", async () => {
        // Given the user cancels the upgrade dialog
        const { command, client, createDialog, upgradeRoom } = setUp(false);

        // When we type /upgraderoom ...
        const result = command.run(client, roomId, null, "12 @foo:bar.com @baz:qux.uk");
        expect(result.promise).toBeDefined();
        await result.promise;

        // Then we warned the user
        expect(createDialog).toHaveBeenCalledWith(
            RoomUpgradeWarningDialog,
            { roomId: "!room:example.com", targetVersion: "12" },
            undefined,
            false,
            true,
        );

        // And when they said no, we did not call into upgradeRoom
        expect(upgradeRoom).not.toHaveBeenCalledWith("!room:example.com", "12", ["@foo:bar.com", "@baz:qux.uk"]);
    });
});
