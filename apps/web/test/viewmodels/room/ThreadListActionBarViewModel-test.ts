/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { ActionBarAction } from "@element-hq/web-shared-components";

import { ThreadListActionBarViewModel } from "../../../src/viewmodels/room/ThreadListActionBarViewModel";

describe("ThreadListActionBarViewModel", () => {
    it("builds the thread-list action bar snapshot", () => {
        const vm = new ThreadListActionBarViewModel({});

        expect(vm.getSnapshot()).toMatchObject({
            actions: [ActionBarAction.ViewInRoom, ActionBarAction.CopyLink],
            presentation: "icon",
            isDownloadEncrypted: false,
            isDownloadLoading: false,
            isPinned: false,
            isQuoteExpanded: false,
            isThreadReplyAllowed: true,
        });
    });

    it("forwards actions to the configured handlers", () => {
        const onViewInRoomClick = jest.fn();
        const onCopyLinkClick = jest.fn();
        const vm = new ThreadListActionBarViewModel({
            onViewInRoomClick,
            onCopyLinkClick,
        });
        const anchor = document.createElement("button");

        vm.onViewInRoomClick(anchor);
        vm.onCopyLinkClick(anchor);

        expect(onViewInRoomClick).toHaveBeenCalledWith(anchor);
        expect(onCopyLinkClick).toHaveBeenCalledWith(anchor);
    });

    it("uses updated handlers after setProps", () => {
        const initialOnViewInRoomClick = jest.fn();
        const nextOnViewInRoomClick = jest.fn();
        const vm = new ThreadListActionBarViewModel({
            onViewInRoomClick: initialOnViewInRoomClick,
        });
        const anchor = document.createElement("button");

        vm.setProps({ onViewInRoomClick: nextOnViewInRoomClick });
        vm.onViewInRoomClick(anchor);

        expect(initialOnViewInRoomClick).not.toHaveBeenCalled();
        expect(nextOnViewInRoomClick).toHaveBeenCalledWith(anchor);
    });
});
