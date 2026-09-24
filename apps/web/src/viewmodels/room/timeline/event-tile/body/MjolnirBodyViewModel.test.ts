/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { vi, describe, it, expect } from "vitest";

import { MjolnirBodyViewModel } from "./MjolnirBodyViewModel";

describe("MjolnirBodyViewModel", () => {
    it("has an empty snapshot", () => {
        const vm = new MjolnirBodyViewModel({ onAllow: vi.fn() });

        expect(vm.getSnapshot()).toEqual({});
    });

    it("forwards the allow action", () => {
        const onAllow = vi.fn();
        const vm = new MjolnirBodyViewModel({ onAllow });

        vm.onAllow();

        expect(onAllow).toHaveBeenCalledTimes(1);
    });

    it("uses the updated action", () => {
        const oldAction = vi.fn();
        const newAction = vi.fn();
        const vm = new MjolnirBodyViewModel({ onAllow: oldAction });

        vm.setProps({ onAllow: newAction });
        vm.onAllow();

        expect(oldAction).not.toHaveBeenCalled();
        expect(newAction).toHaveBeenCalledTimes(1);
    });

    it("does not emit snapshot updates for unchanged action inputs", () => {
        const props = { onAllow: vi.fn() };
        const listener = vi.fn();
        const vm = new MjolnirBodyViewModel(props);

        vm.subscribe(listener);

        vm.setProps(props);

        expect(listener).not.toHaveBeenCalled();
    });
});
