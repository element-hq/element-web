/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { describe, it, expect, vi } from "vitest";

import { RedactedBodyViewModel } from "./RedactedBodyViewModel";

describe("RedactedBodyViewModel", () => {
    it("exposes the supplied render snapshot", () => {
        const props = {
            text: "Message deleted",
            tooltip: "Deleted yesterday",
        };
        const vm = new RedactedBodyViewModel(props);

        expect(vm.getSnapshot()).toEqual(props);
    });

    it("updates the render snapshot when props change", () => {
        const vm = new RedactedBodyViewModel({ text: "Message deleted" });

        vm.setProps({ text: "Message deleted by Alice", tooltip: "Deleted yesterday" });

        expect(vm.getSnapshot()).toEqual({
            text: "Message deleted by Alice",
            tooltip: "Deleted yesterday",
        });
    });

    it("does not notify for unchanged props", () => {
        const props = { text: "Message deleted" };
        const vm = new RedactedBodyViewModel(props);
        const listener = vi.fn();

        vm.subscribe(listener);
        vm.setProps(props);

        expect(listener).not.toHaveBeenCalled();
    });
});
