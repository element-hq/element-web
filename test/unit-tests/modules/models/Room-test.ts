/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Room } from "../../../../src/modules/models/Room";
import { mkRoom, stubClient } from "../../../test-utils";

describe("Room", () => {
    it("should return id from sdk room", () => {
        const cli = stubClient();
        const sdkRoom = mkRoom(cli, "!foo:m.org");
        const room = new Room(sdkRoom);
        expect(room.id).toStrictEqual("!foo:m.org");
    });

    it("should return last timestamp from sdk room", () => {
        const cli = stubClient();
        const sdkRoom = mkRoom(cli, "!foo:m.org");
        const room = new Room(sdkRoom);
        expect(room.getLastActiveTimestamp()).toStrictEqual(sdkRoom.getLastActiveTimestamp());
    });

    describe("watchableName", () => {
        it("should return name from sdkRoom", () => {
            const cli = stubClient();
            const sdkRoom = mkRoom(cli, "!foo:m.org");
            sdkRoom.name = "Foo Name";
            const room = new Room(sdkRoom);
            expect(room.name.value).toStrictEqual("Foo Name");
        });

        it("should add/remove event listener on sdk room", () => {
            const cli = stubClient();
            const sdkRoom = mkRoom(cli, "!foo:m.org");
            sdkRoom.name = "Foo Name";

            const room = new Room(sdkRoom);
            const fn = jest.fn();

            room.name.watch(fn);
            expect(sdkRoom.on).toHaveBeenCalledTimes(1);

            room.name.unwatch(fn);
            expect(sdkRoom.off).toHaveBeenCalledTimes(1);
        });
    });
});
