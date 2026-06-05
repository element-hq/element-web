/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, type JSX } from "react";
import { ActionBarView } from "@element-hq/web-shared-components";

import { type ThreadListActionBarViewModel } from "../../../../viewmodels/room/ThreadListActionBarViewModel";

/**
 * Props for the {@link ThreadListActionBarAdapter} component.
 */
interface ThreadListActionBarAdapterProps {
    /** View model owned by the parent event tile container. */
    vm: ThreadListActionBarViewModel;
    /** Opens the event in the room timeline. */
    onViewInRoomClick: (anchor: HTMLElement | null) => void;
    /** Copies the event permalink to the clipboard. */
    onCopyLinkClick: (anchor: HTMLElement | null) => void | Promise<void>;
    /** Optional class name applied to the action bar. */
    className?: string;
}

/**
 * Renders the action bar used by the thread list view.
 */
export function ThreadListActionBarAdapter({
    vm,
    onViewInRoomClick,
    onCopyLinkClick,
    className,
}: Readonly<ThreadListActionBarAdapterProps>): JSX.Element {
    useEffect(() => {
        vm.setProps({
            onViewInRoomClick,
            onCopyLinkClick,
        });
    }, [vm, onViewInRoomClick, onCopyLinkClick]);

    return <ActionBarView vm={vm} className={className} />;
}
