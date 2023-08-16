/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { Room } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import SpaceStore from "../../src/stores/spaces/SpaceStore";
import { stubClient } from "../test-utils";
import { roomContextDetails } from "../../src/utils/i18n-helpers";
import DMRoomMap from "../../src/utils/DMRoomMap";

describe("roomContextDetails", () => {
    const client = stubClient();
    DMRoomMap.makeShared(client);

    const room = new Room("!room:server", client, client.getSafeUserId());
    const parent1 = new Room("!parent1:server", client, client.getSafeUserId());
    parent1.name = "Alpha";
    const parent2 = new Room("!parent2:server", client, client.getSafeUserId());
    parent2.name = "Beta";
    const parent3 = new Room("!parent3:server", client, client.getSafeUserId());
    parent3.name = "Charlie";
    mocked(client.getRoom).mockImplementation((roomId) => {
        return [parent1, parent2, parent3].find((r) => r.roomId === roomId) ?? null;
    });

    it("should return 1-parent variant", () => {
        jest.spyOn(SpaceStore.instance, "getKnownParents").mockReturnValue(new Set([parent1.roomId]));
        const res = roomContextDetails(room);
        expect(res!.details).toMatchInlineSnapshot(`"Alpha"`);
        expect(res!.ariaLabel).toMatchInlineSnapshot(`"In Alpha."`);
    });

    it("should return 2-parent variant", () => {
        jest.spyOn(SpaceStore.instance, "getKnownParents").mockReturnValue(new Set([parent2.roomId, parent3.roomId]));
        const res = roomContextDetails(room);
        expect(res!.details).toMatchInlineSnapshot(`"Beta and Charlie"`);
        expect(res!.ariaLabel).toMatchInlineSnapshot(`"In spaces Beta and Charlie."`);
    });

    it("should return n-parent variant", () => {
        jest.spyOn(SpaceStore.instance, "getKnownParents").mockReturnValue(
            new Set([parent1.roomId, parent2.roomId, parent3.roomId]),
        );
        const res = roomContextDetails(room);
        expect(res!.details).toMatchInlineSnapshot(`"Alpha and 1 other"`);
        expect(res!.ariaLabel).toMatchInlineSnapshot(`"In Alpha and 1 other space."`);
    });
});
