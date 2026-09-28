/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { createElement } from "react";
import { describe, it, expect, vi } from "vitest";
import type { MediaPreviewGroupEntry } from "@element-hq/web-shared-components";

import { MediaPreviewGroupViewModel } from "./MediaPreviewGroupViewModel";

describe("MediaPreviewGroupViewModel", () => {
    const mkEntry = (id: string): MediaPreviewGroupEntry => ({
        id,
        type: "text",
        header: `header ${id}`,
        body: `body ${id}`,
        icon: createElement("svg"),
        color: "#ff0000",
    });

    it("exposes the supplied entries as its snapshot", () => {
        const props = { entries: [mkEntry("$one")] };

        expect(new MediaPreviewGroupViewModel(props).getSnapshot()).toEqual(props);
    });

    it("replaces the entries and notifies subscribers", () => {
        const vm = new MediaPreviewGroupViewModel({ entries: [mkEntry("$one")] });
        const listener = vi.fn();
        vm.subscribe(listener);

        const replacement = { entries: [mkEntry("$two"), mkEntry("$three")] };
        vm.setProps(replacement);

        expect(vm.getSnapshot()).toEqual(replacement);
        expect(listener).toHaveBeenCalled();
    });

    it("replaces the entries with an empty group", () => {
        const vm = new MediaPreviewGroupViewModel({ entries: [mkEntry("$one")] });

        vm.setProps({ entries: [] });

        expect(vm.getSnapshot()).toEqual({ entries: [] });
    });
});
