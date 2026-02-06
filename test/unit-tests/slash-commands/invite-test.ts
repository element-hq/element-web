/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import Modal, { type ComponentType, type IHandle } from "../../../src/Modal";
import { setUpCommandTest } from "./utils";

describe("/invite", () => {
    const roomId = "!room:example.com";

    it("should return usage if no args", () => {
        const { client, command } = setUpCommandTest(roomId, `/invite`);
        expect(command.run(client, roomId, null, undefined).error).toBe(command.getUsage());
    });

    it("should invite the user we specify to this room", async () => {
        const spy = jest.spyOn(Modal, "createDialog");
        spy.mockReturnValue({ close: () => {} } as unknown as IHandle<ComponentType>);

        const { client, command, args } = setUpCommandTest(roomId, `/invite @u:s.co`);

        await command.run(client, roomId, null, args).promise;

        expect(client.invite).toHaveBeenCalledWith(roomId, "@u:s.co", {});
    });

    it("should provide the invite reason if we supply it", async () => {
        const spy = jest.spyOn(Modal, "createDialog");
        spy.mockReturnValue({ close: () => {} } as unknown as IHandle<ComponentType>);

        const { client, command, args } = setUpCommandTest(roomId, `/invite @u:s.co They are a very nice person`);

        await command.run(client, roomId, null, args).promise;

        expect(client.invite).toHaveBeenCalledWith(roomId, "@u:s.co", { reason: "They are a very nice person" });
    });
});
