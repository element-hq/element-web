/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { afterEach, describe, expect, it, vi } from "vitest";

import { allowMjolnirBody, getMjolnirBodyStorageKey, isMjolnirBodyAllowed } from "./EventTileMjolnirBodyState";

describe("EventTileMjolnirBodyState", () => {
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("derives the application storage key from an event", () => {
        const event = new MatrixEvent({
            room_id: "!room:example.org",
            event_id: "$event:example.org",
        });

        expect(getMjolnirBodyStorageKey(event)).toBe("mx_mjolnir_render_!room:example.org__$event:example.org");
    });

    it("reads whether an event has been allowed", () => {
        const event = new MatrixEvent({
            room_id: "!room:example.org",
            event_id: "$event:example.org",
        });

        expect(isMjolnirBodyAllowed(event)).toBe(false);
        allowMjolnirBody(event);
        expect(isMjolnirBodyAllowed(event)).toBe(true);
    });

    it("stores the allow decision and notifies the owning tile", () => {
        const event = new MatrixEvent({
            room_id: "!room:example.org",
            event_id: "$event:example.org",
        });
        const onMessageAllowed = vi.fn();

        allowMjolnirBody(event, onMessageAllowed);

        expect(localStorage.getItem("mx_mjolnir_render_!room:example.org__$event:example.org")).toBe("true");
        expect(onMessageAllowed).toHaveBeenCalledTimes(1);
    });
});
