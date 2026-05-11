/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MouseEvent } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { MjolnirBodyViewModel } from "../../../src/viewmodels/room/timeline/event-tile/body/MjolnirBodyViewModel";

describe("MjolnirBodyViewModel", () => {
    const createEvent = (roomId = "!room:example.com", eventId = "$event:example.com"): MatrixEvent =>
        ({
            getRoomId: jest.fn().mockReturnValue(roomId),
            getId: jest.fn().mockReturnValue(eventId),
        }) as unknown as MatrixEvent;

    const createClickEvent = (): MouseEvent<HTMLButtonElement> =>
        ({
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        }) as unknown as MouseEvent<HTMLButtonElement>;

    afterEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
    });

    it("has an empty snapshot", () => {
        const vm = new MjolnirBodyViewModel({ mxEvent: createEvent() });

        expect(vm.getSnapshot()).toEqual({});
    });

    it("allows rendering the hidden event and notifies the parent", () => {
        const onMessageAllowed = jest.fn();
        const vm = new MjolnirBodyViewModel({
            mxEvent: createEvent("!room:example.com", "$hidden:example.com"),
            onMessageAllowed,
        });
        const event = createClickEvent();

        vm.onAllowClick(event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
        expect(localStorage.getItem("mx_mjolnir_render_!room:example.com__$hidden:example.com")).toBe("true");
        expect(onMessageAllowed).toHaveBeenCalledTimes(1);
    });

    it("uses the updated event and callback", () => {
        const oldCallback = jest.fn();
        const newCallback = jest.fn();
        const vm = new MjolnirBodyViewModel({
            mxEvent: createEvent("!old:example.com", "$old:example.com"),
            onMessageAllowed: oldCallback,
        });

        vm.setEvent(createEvent("!new:example.com", "$new:example.com"));
        vm.setOnMessageAllowed(newCallback);
        vm.onAllowClick(createClickEvent());

        expect(localStorage.getItem("mx_mjolnir_render_!old:example.com__$old:example.com")).toBeNull();
        expect(localStorage.getItem("mx_mjolnir_render_!new:example.com__$new:example.com")).toBe("true");
        expect(oldCallback).not.toHaveBeenCalled();
        expect(newCallback).toHaveBeenCalledTimes(1);
    });

    it("does not emit snapshot updates for unchanged action inputs", () => {
        const mxEvent = createEvent();
        const onMessageAllowed = jest.fn();
        const listener = jest.fn();
        const vm = new MjolnirBodyViewModel({ mxEvent, onMessageAllowed });

        vm.subscribe(listener);

        vm.setEvent(mxEvent);
        vm.setOnMessageAllowed(onMessageAllowed);

        expect(listener).not.toHaveBeenCalled();
    });
});
