/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ElementWebBuiltinsApi } from "../../../src/modules/BuiltinsApi";

describe("ElementWebBuiltinsApi", () => {
    it("returns the RoomView component thats been set", () => {
        const builtinsApi = new ElementWebBuiltinsApi();
        const sentinel = {};
        builtinsApi.setRoomViewComponent(sentinel as any);
        expect(builtinsApi.getRoomViewComponent()).toBe(sentinel);
    });
});
