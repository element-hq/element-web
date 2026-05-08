/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { HiddenBodyViewModel } from "../../../src/viewmodels/room/timeline/event-tile/body/HiddenBodyViewModel";

describe("HiddenBodyViewModel", () => {
    const createEvent = (visible: boolean, reason?: string | null): MatrixEvent =>
        ({
            messageVisibility: jest.fn().mockReturnValue({
                visible,
                reason,
            }),
        }) as unknown as MatrixEvent;

    it("extracts a moderation reason from a hidden event", () => {
        const vm = new HiddenBodyViewModel({ mxEvent: createEvent(false, "spam") });

        expect(vm.getSnapshot()).toEqual({
            reason: "spam",
        });
    });

    it("omits the reason when the hidden event has no reason", () => {
        const vm = new HiddenBodyViewModel({ mxEvent: createEvent(false, null) });

        expect(vm.getSnapshot()).toEqual({
            reason: undefined,
        });
    });

    it("throws when created for a visible event", () => {
        expect(() => new HiddenBodyViewModel({ mxEvent: createEvent(true) })).toThrow(
            "HiddenBodyViewModel should only be applied to hidden messages",
        );
    });

    it("updates the snapshot when the event changes", () => {
        const vm = new HiddenBodyViewModel({ mxEvent: createEvent(false) });

        vm.setEvent(createEvent(false, "abuse"));

        expect(vm.getSnapshot()).toEqual({
            reason: "abuse",
        });
    });

    it("does not emit when setEvent receives the current event", () => {
        const event = createEvent(false, "spam");
        const vm = new HiddenBodyViewModel({ mxEvent: event });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setEvent(event);

        expect(listener).not.toHaveBeenCalled();
    });
});
