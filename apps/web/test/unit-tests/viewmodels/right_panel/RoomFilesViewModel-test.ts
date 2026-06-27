/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { RoomFilesViewModel } from "../../../../src/viewmodels/right_panel/RoomFilesViewModel";
import { FileCategory } from "../../../../src/utils/FileCategory";

describe("RoomFilesViewModel", () => {
    it("starts on the All tab with an empty search term", () => {
        const vm = new RoomFilesViewModel();
        expect(vm.getSnapshot()).toEqual({ activeCategory: FileCategory.All, searchTerm: "" });
    });

    it("setCategory updates the active category and notifies subscribers", () => {
        const vm = new RoomFilesViewModel();
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setCategory(FileCategory.Voice);

        expect(vm.getSnapshot().activeCategory).toBe(FileCategory.Voice);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("setSearchTerm updates the term and notifies subscribers", () => {
        const vm = new RoomFilesViewModel();
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setSearchTerm("report");

        expect(vm.getSnapshot().searchTerm).toBe("report");
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("does not notify when the category is unchanged", () => {
        const vm = new RoomFilesViewModel();
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setCategory(FileCategory.All);

        expect(listener).not.toHaveBeenCalled();
    });
});
