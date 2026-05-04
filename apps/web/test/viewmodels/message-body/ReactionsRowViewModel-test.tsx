/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MouseEvent } from "react";

import {
    MAX_ITEMS_WHEN_LIMITED,
    ReactionsRowViewModel,
} from "../../../src/viewmodels/room/timeline/event-tile/reactions/ReactionsRowViewModel";

describe("ReactionsRowViewModel", () => {
    const createVm = (
        overrides?: Partial<ConstructorParameters<typeof ReactionsRowViewModel>[0]>,
    ): ReactionsRowViewModel =>
        new ReactionsRowViewModel({
            isActionable: true,
            reactionGroupCount: 10,
            canReact: true,
            ...overrides,
        });

    it("computes initial snapshot from props", () => {
        const vm = createVm();
        const snapshot = vm.getSnapshot();

        expect(snapshot.isVisible).toBe(true);
        expect(snapshot.showAllButtonVisible).toBe(true);
        expect(snapshot.showAddReactionButton).toBe(true);
        expect(snapshot.addReactionButtonActive).toBe(false);
        expect(snapshot.addReactionMenuAnchorRect).toBeUndefined();
        expect(snapshot.isAddReactionMenuOpen).toBe(false);
    });

    it("hides show-all after onShowAllClick", () => {
        const vm = createVm();
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.onShowAllClick();

        expect(vm.getSnapshot().showAllButtonVisible).toBe(false);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("updates visibility when reaction group count changes", () => {
        const vm = createVm();

        vm.setReactionGroupCount(0);

        expect(vm.getSnapshot().isVisible).toBe(false);
    });

    it("updates add-reaction button visibility from canReact", () => {
        const vm = createVm();

        vm.setCanReact(false);

        expect(vm.getSnapshot().showAddReactionButton).toBe(false);
    });

    it("updates show-all visibility when reaction group count changes", () => {
        const vm = createVm({ reactionGroupCount: MAX_ITEMS_WHEN_LIMITED });

        expect(vm.getSnapshot().showAllButtonVisible).toBe(false);

        vm.setReactionGroupCount(MAX_ITEMS_WHEN_LIMITED + 2);

        expect(vm.getSnapshot().showAllButtonVisible).toBe(true);
    });

    it("opens and closes the add-reaction menu", () => {
        const vm = createVm();
        const rect = new DOMRect(1, 2, 3, 4);
        const anchor = document.createElement("button");
        jest.spyOn(anchor, "getBoundingClientRect").mockReturnValue(rect);

        vm.openAddReactionMenu(anchor);

        expect(vm.getSnapshot().addReactionButtonActive).toBe(true);
        expect(vm.getSnapshot().addReactionMenuAnchorRect).toBe(rect);
        expect(vm.getSnapshot().isAddReactionMenuOpen).toBe(true);

        vm.closeAddReactionMenu();

        expect(vm.getSnapshot().addReactionButtonActive).toBe(false);
        expect(vm.getSnapshot().addReactionMenuAnchorRect).toBeUndefined();
        expect(vm.getSnapshot().isAddReactionMenuOpen).toBe(false);
    });

    it("opens the add-reaction menu from add-reaction actions", () => {
        const vm = createVm();
        const rect = new DOMRect(1, 2, 3, 4);
        const anchor = document.createElement("button");
        const preventDefault = jest.fn();
        jest.spyOn(anchor, "getBoundingClientRect").mockReturnValue(rect);

        vm.onAddReactionClick({ currentTarget: anchor } as MouseEvent<HTMLButtonElement>);
        expect(vm.getSnapshot().addReactionMenuAnchorRect).toBe(rect);

        vm.closeAddReactionMenu();
        vm.onAddReactionContextMenu({
            currentTarget: anchor,
            preventDefault,
        } as unknown as MouseEvent<HTMLButtonElement>);

        expect(preventDefault).toHaveBeenCalled();
        expect(vm.getSnapshot().addReactionMenuAnchorRect).toBe(rect);
    });

    it("closes the add-reaction menu when reactions become unavailable", () => {
        const vm = createVm();
        const rect = new DOMRect(1, 2, 3, 4);
        const anchor = document.createElement("button");
        jest.spyOn(anchor, "getBoundingClientRect").mockReturnValue(rect);

        vm.openAddReactionMenu(anchor);
        vm.setCanReact(false);

        expect(vm.getSnapshot().showAddReactionButton).toBe(false);
        expect(vm.getSnapshot().addReactionButtonActive).toBe(false);
        expect(vm.getSnapshot().addReactionMenuAnchorRect).toBeUndefined();
        expect(vm.getSnapshot().isAddReactionMenuOpen).toBe(false);
    });

    it("does not emit when derived values are unchanged", () => {
        const vm = createVm();
        const previousSnapshot = vm.getSnapshot();
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setCanReact(true);
        vm.setReactionGroupCount(10);
        vm.setActionable(true);

        // Snapshot merges skip emitting when all derived values are unchanged.
        expect(listener).toHaveBeenCalledTimes(0);
        expect(vm.getSnapshot()).toEqual(previousSnapshot);
    });
});
