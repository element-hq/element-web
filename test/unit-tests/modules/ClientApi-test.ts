/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ClientApi } from "../../../src/modules/ClientApi";
import * as utils from "../../../src/modules/common";
import { Room } from "../../../src/modules/models/Room";
import { stubClient } from "../../test-utils/test-utils";

describe("ClientApi", () => {
    it("should return module room from getRoom()", () => {
        const cli = stubClient();
        jest.spyOn(utils, "getSafeCli").mockReturnValue(cli);
        const client = new ClientApi();
        const moduleRoom = client.getRoom("!foo:matrix.org");
        expect(moduleRoom).toBeInstanceOf(Room);
        expect(moduleRoom?.id).toStrictEqual("!foo:matrix.org");
    });
});
