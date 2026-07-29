/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { MjolnirBodyViewModel } from "../../../src/viewmodels/room/timeline/event-tile/body/MjolnirBodyViewModel";

describe("MjolnirBodyViewModel", () => {
    it("has an empty snapshot", () => {
        const vm = new MjolnirBodyViewModel({ onAllow: jest.fn() });

        expect(vm.getSnapshot()).toEqual({});
    });

    it("forwards the allow action", () => {
        const onAllow = jest.fn();
        const vm = new MjolnirBodyViewModel({ onAllow });

        vm.onAllow();

        expect(onAllow).toHaveBeenCalledTimes(1);
    });

    it("uses the updated action", () => {
        const oldAction = jest.fn();
        const newAction = jest.fn();
        const vm = new MjolnirBodyViewModel({ onAllow: oldAction });

        vm.setProps({ onAllow: newAction });
        vm.onAllow();

        expect(oldAction).not.toHaveBeenCalled();
        expect(newAction).toHaveBeenCalledTimes(1);
    });

    it("does not emit snapshot updates for unchanged action inputs", () => {
        const props = { onAllow: jest.fn() };
        const listener = jest.fn();
        const vm = new MjolnirBodyViewModel(props);

        vm.subscribe(listener);

        vm.setProps(props);

        expect(listener).not.toHaveBeenCalled();
    });
});
