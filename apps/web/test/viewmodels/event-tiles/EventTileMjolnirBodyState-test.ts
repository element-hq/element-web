/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import {
    allowMjolnirBody,
    getMjolnirBodyStorageKey,
} from "../../../src/viewmodels/room/timeline/event-tile/EventTileMjolnirBodyState";

describe("EventTile Mjolnir body state", () => {
    afterEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
    });

    it("derives the application storage key from an event", () => {
        const event = new MatrixEvent({
            room_id: "!room:example.org",
            event_id: "$event:example.org",
        });

        expect(getMjolnirBodyStorageKey(event)).toBe("mx_mjolnir_render_!room:example.org__$event:example.org");
    });

    it("stores the allow decision and notifies the owning tile", () => {
        const event = new MatrixEvent({
            room_id: "!room:example.org",
            event_id: "$event:example.org",
        });
        const onMessageAllowed = jest.fn();

        allowMjolnirBody(event, onMessageAllowed);

        expect(localStorage.getItem("mx_mjolnir_render_!room:example.org__$event:example.org")).toBe("true");
        expect(onMessageAllowed).toHaveBeenCalledTimes(1);
    });
});
