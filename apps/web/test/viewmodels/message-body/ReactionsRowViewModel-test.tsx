/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MouseEvent } from "react";

import { ReactionsRowViewModel } from "../../../src/viewmodels/message-body/ReactionsRowViewModel";

describe("ReactionsRowViewModel", () => {
    const createVm = (
        overrides?: Partial<ConstructorParameters<typeof ReactionsRowViewModel>[0]>,
    ): ReactionsRowViewModel =>
        new ReactionsRowViewModel({
            isActionable: true,
            reactionGroupCount: 10,
            canReact: true,
            addReactionButtonActive: false,
            ...overrides,
        });

    it("computes initial snapshot from props", () => {
        const vm = createVm();
        const snapshot = vm.getSnapshot();

        expect(snapshot.isVisible).toBe(true);
        expect(snapshot.showAllButtonVisible).toBe(true);
        expect(snapshot.showAddReactionButton).toBe(true);
        expect(snapshot.addReactionButtonActive).toBe(false);
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

    it("updates add-reaction active state", () => {
        const vm = createVm();

        vm.setAddReactionButtonActive(true);

        expect(vm.getSnapshot().addReactionButtonActive).toBe(true);
    });

    it("forwards add-reaction handlers", () => {
        const vm = createVm();
        const onAddReactionClick = jest.fn();
        const onAddReactionContextMenu = jest.fn();

        vm.setAddReactionHandlers({
            onAddReactionClick,
            onAddReactionContextMenu,
        });

        const clickEvent = {
            currentTarget: document.createElement("button"),
        } as unknown as MouseEvent<HTMLButtonElement>;
        vm.onAddReactionClick(clickEvent);
        vm.onAddReactionContextMenu(clickEvent);

        expect(onAddReactionClick).toHaveBeenCalledWith(clickEvent);
        expect(onAddReactionContextMenu).toHaveBeenCalledWith(clickEvent);
    });

    it("emits only for setters that always merge when values are unchanged", () => {
        const vm = createVm();
        const previousSnapshot = vm.getSnapshot();
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setCanReact(true);
        vm.setReactionGroupCount(10);
        vm.setActionable(true);
        vm.setAddReactionButtonActive(false);

        // `setReactionGroupCount` is optimized and skips emit for unchanged derived values.
        // The other setters always merge and therefore emit.
        expect(listener).toHaveBeenCalledTimes(3);
        expect(vm.getSnapshot()).toEqual(previousSnapshot);
    });
});
