/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { ImageReplyBodyViewModel } from "../../../../../src/viewmodels/message-body/ImageReplyBodyViewModel";

describe("ImageReplyBodyViewModel", () => {
    it("defaults to a visible reply image body", () => {
        const vm = new ImageReplyBodyViewModel();

        expect(vm.getSnapshot()).toEqual({
            isVisible: true,
        });
    });

    it("updates the snapshot when visibility changes", () => {
        const vm = new ImageReplyBodyViewModel();
        const listener = jest.fn();

        vm.subscribe(listener);
        vm.setVisible(false);

        expect(vm.getSnapshot()).toEqual({
            isVisible: false,
        });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("does not emit when visibility is unchanged", () => {
        const vm = new ImageReplyBodyViewModel({ isVisible: true });
        const listener = jest.fn();

        vm.subscribe(listener);
        vm.setVisible(true);

        expect(vm.getSnapshot()).toEqual({
            isVisible: true,
        });
        expect(listener).not.toHaveBeenCalled();
    });
});
