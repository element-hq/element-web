/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 * Copyright 2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import Modal from "../../../src/Modal";
import { setUpCommandTest } from "./utils";

describe("/topic", () => {
    const roomId = "!room:example.com";

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
