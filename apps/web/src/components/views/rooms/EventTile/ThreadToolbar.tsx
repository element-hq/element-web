/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, type JSX } from "react";
import { ActionBarView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { ThreadListActionBarViewModel } from "../../../../viewmodels/room/ThreadListActionBarViewModel";

/**
 * Props used to render the interactive thread action bar.
 */
export type ThreadToolbarProps = Readonly<{
    onViewInRoomClick: (anchor: HTMLElement | null) => void;
    onCopyLinkClick: (anchor: HTMLElement | null) => void | Promise<void>;
}>;

export function ThreadToolbar({ onViewInRoomClick, onCopyLinkClick }: Readonly<ThreadToolbarProps>): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new ThreadListActionBarViewModel({
                onViewInRoomClick,
                onCopyLinkClick,
            }),
    );

    useEffect(() => {
        vm.setProps({
            onViewInRoomClick,
            onCopyLinkClick,
        });
    }, [vm, onViewInRoomClick, onCopyLinkClick]);

    return <ActionBarView vm={vm} className="mx_ThreadActionBar" />;
}
