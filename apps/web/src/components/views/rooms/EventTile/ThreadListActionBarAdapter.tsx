/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, type JSX } from "react";
import { ActionBarView } from "@element-hq/web-shared-components";

import { type EventTileViewModel } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";

interface ThreadListActionBarAdapterProps {
    eventTileViewModel: EventTileViewModel;
    onViewInRoomClick: (anchor: HTMLElement | null) => void;
    onCopyLinkClick: (anchor: HTMLElement | null) => void | Promise<void>;
    className?: string;
}

export function ThreadListActionBarAdapter({
    eventTileViewModel,
    onViewInRoomClick,
    onCopyLinkClick,
    className,
}: Readonly<ThreadListActionBarAdapterProps>): JSX.Element {
    const vm = eventTileViewModel.getThreadListActionBarViewModel({
        onViewInRoomClick,
        onCopyLinkClick,
    });

    useEffect(() => {
        vm.setProps({
            onViewInRoomClick,
            onCopyLinkClick,
        });
    }, [vm, onViewInRoomClick, onCopyLinkClick]);

    return <ActionBarView vm={vm} className={className} />;
}
