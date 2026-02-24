/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 * Copyright 2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { KnownMembership, RoomMember } from "matrix-js-sdk/src/matrix";

import { setUpCommandTest } from "./utils";
import { warnSelfDemote } from "../../../src/components/views/right_panel/UserInfo";

jest.mock("../../../src/components/views/right_panel/UserInfo");

describe("/op", () => {
    const roomId = "!room:example.com";

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
    const roomId = "!room:example.com";

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
