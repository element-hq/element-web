/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 * Copyright 2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { setUpCommandTest } from "./utils";
import dispatcher from "../../../src/dispatcher/dispatcher";

describe("/join", () => {
    const roomId = "!room:example.com";

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
