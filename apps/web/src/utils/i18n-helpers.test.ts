/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { Room } from "matrix-js-sdk/src/matrix";
import { stubClient } from "test-utils";

import { roomContextDetails } from "./i18n-helpers";
import DMRoomMap from "./DMRoomMap";
import { SDKContextClass } from "../contexts/SDKContextClass.ts";

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
    vi.mocked(client.getRoom).mockImplementation((roomId) => {
        return [parent1, parent2, parent3].find((r) => r.roomId === roomId) ?? null;
    });

    it("should return 1-parent variant", () => {
        vi.spyOn(SDKContextClass.instance.spaceStore, "getKnownParents").mockReturnValue(new Set([parent1.roomId]));
        const res = roomContextDetails(room);
        expect(res!.details).toMatchInlineSnapshot(`"Alpha"`);
        expect(res!.ariaLabel).toMatchInlineSnapshot(`"In Alpha."`);
    });

    it("should return 2-parent variant", () => {
        vi.spyOn(SDKContextClass.instance.spaceStore, "getKnownParents").mockReturnValue(
            new Set([parent2.roomId, parent3.roomId]),
        );
        const res = roomContextDetails(room);
        expect(res!.details).toMatchInlineSnapshot(`"Beta and Charlie"`);
        expect(res!.ariaLabel).toMatchInlineSnapshot(`"In spaces Beta and Charlie."`);
    });

    it("should return n-parent variant", () => {
        vi.spyOn(SDKContextClass.instance.spaceStore, "getKnownParents").mockReturnValue(
            new Set([parent1.roomId, parent2.roomId, parent3.roomId]),
        );
        const res = roomContextDetails(room);
        expect(res!.details).toMatchInlineSnapshot(`"Alpha and one other"`);
        expect(res!.ariaLabel).toMatchInlineSnapshot(`"In Alpha and one other space."`);
    });
});
