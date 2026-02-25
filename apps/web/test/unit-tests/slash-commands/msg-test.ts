/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { setUpCommandTest } from "./utils";
import dispatcher from "../../../src/dispatcher/dispatcher";
import DMRoomMap from "../../../src/utils/DMRoomMap";

describe("/msg", () => {
    const roomId = "!room:example.com";

    it("should return usage if no args", () => {
        const { client, command } = setUpCommandTest(roomId, `/msg`);
        expect(command.run(client, roomId, null, undefined).error).toBe(command.getUsage());
    });

    it("should message the user and switch to the relevant DM", async () => {
        // Given there is no DM room with the user
        jest.spyOn(DMRoomMap, "shared").mockReturnValue({
            getDMRoomsForUserId: jest.fn().mockReturnValue([]),
            getRoomIds: jest.fn().mockReturnValue([roomId]),
        } as unknown as DMRoomMap);

        jest.spyOn(dispatcher, "dispatch");

        // When we send a message to that user
        const { client, command, args } = setUpCommandTest(roomId, `/msg @u:s.co Hello there`);
        await command.run(client, roomId, null, args).promise;

        // Then we create a room and send the message in there
        expect(client.sendTextMessage).toHaveBeenCalledWith("!1:example.org", "Hello there");

        // And tell the UI to switch to that room
        expect(dispatcher.dispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "view_room",
                metricsTrigger: "SlashCommand",
                metricsViaKeyboard: true,
                room_id: "!1:example.org",
            }),
        );
    });
});
