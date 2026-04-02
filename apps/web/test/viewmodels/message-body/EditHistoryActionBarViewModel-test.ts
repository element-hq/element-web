/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { ActionBarAction } from "@element-hq/web-shared-components";

import { EditHistoryActionBarViewModel } from "../../../src/viewmodels/message-body/EditHistoryActionBarViewModel";

describe("EditHistoryActionBarViewModel", () => {
    it("builds a label snapshot with remove and view source actions", () => {
        const vm = new EditHistoryActionBarViewModel({
            canRemove: true,
            showViewSource: true,
        });

        expect(vm.getSnapshot()).toMatchObject({
            actions: [ActionBarAction.Remove, ActionBarAction.ViewSource],
            presentation: "label",
            isDownloadEncrypted: false,
            isDownloadLoading: false,
            isPinned: false,
            isQuoteExpanded: false,
            isThreadReplyAllowed: true,
        });
    });

    it("omits actions that are disabled by props", () => {
        const vm = new EditHistoryActionBarViewModel({
            canRemove: false,
            showViewSource: false,
        });

        expect(vm.getSnapshot().actions).toEqual([]);
    });

    it("updates the snapshot when props change", () => {
        const vm = new EditHistoryActionBarViewModel({
            canRemove: false,
            showViewSource: true,
        });

        expect(vm.getSnapshot().actions).toEqual([ActionBarAction.ViewSource]);

        vm.setProps({
            canRemove: true,
            showViewSource: false,
        });

        expect(vm.getSnapshot().actions).toEqual([ActionBarAction.Remove]);
    });

    it("forwards remove clicks to props", () => {
        const onRemoveClick = jest.fn();
        const vm = new EditHistoryActionBarViewModel({
            canRemove: true,
            showViewSource: false,
            onRemoveClick,
        });
        const anchor = document.createElement("button");

        vm.onRemoveClick(anchor);

        expect(onRemoveClick).toHaveBeenCalledWith(anchor);
    });

    it("forwards view source clicks to props", () => {
        const onViewSourceClick = jest.fn();
        const vm = new EditHistoryActionBarViewModel({
            canRemove: false,
            showViewSource: true,
            onViewSourceClick,
        });
        const anchor = document.createElement("button");

        vm.onViewSourceClick(anchor);

        expect(onViewSourceClick).toHaveBeenCalledWith(anchor);
    });
});
