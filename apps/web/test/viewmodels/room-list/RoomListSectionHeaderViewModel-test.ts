/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { RoomListSectionHeaderViewModel } from "../../../src/viewmodels/room-list/RoomListSectionHeaderViewModel";

describe("RoomListSectionHeaderViewModel", () => {
    let onToggleExpanded: jest.Mock;

    beforeEach(() => {
        onToggleExpanded = jest.fn();
    });

    it("should initialize snapshot from props", () => {
        const vm = new RoomListSectionHeaderViewModel({
            tag: "m.favourite",
            title: "Favourites",
            onToggleExpanded,
        });

        const snapshot = vm.getSnapshot();
        expect(snapshot.id).toBe("m.favourite");
        expect(snapshot.title).toBe("Favourites");
        expect(snapshot.isExpanded).toBe(true);
    });

    it("should toggle expanded state on click", () => {
        const vm = new RoomListSectionHeaderViewModel({
            tag: "m.favourite",
            title: "Favourites",
            onToggleExpanded,
        });
        expect(vm.isExpanded).toBe(true);

        vm.onClick();
        expect(vm.isExpanded).toBe(false);
        expect(vm.getSnapshot().isExpanded).toBe(false);
        expect(onToggleExpanded).toHaveBeenCalledWith(false);

        vm.onClick();
        expect(vm.isExpanded).toBe(true);
        expect(vm.getSnapshot().isExpanded).toBe(true);
        expect(onToggleExpanded).toHaveBeenCalledWith(true);
    });
});
