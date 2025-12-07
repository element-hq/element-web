/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type PropsWithChildren } from "react";
import { ContextMenu } from "@vector-im/compound-web";

import { _t } from "../../utils/i18n";
import {
    MoreOptionContent,
    type MoreOptionsMenuState,
    type MoreOptionsMenuCallbacks,
} from "./RoomListItemMoreOptionsMenu";

/**
 * Props for RoomListItemContextMenu component
 */
export interface RoomListItemContextMenuProps {
    /** More options menu state */
    state: MoreOptionsMenuState;
    /** More options menu callbacks */
    callbacks: MoreOptionsMenuCallbacks;
    /** Callback when menu open state changes */
    onMenuOpenChange: (isOpen: boolean) => void;
}

/**
 * The context menu for room list items.
 * Wraps the trigger element with a right-click context menu displaying room options.
 */
export const RoomListItemContextMenu: React.FC<PropsWithChildren<RoomListItemContextMenuProps>> = ({
    state,
    callbacks,
    onMenuOpenChange,
    children,
}): JSX.Element => {
    return (
        <ContextMenu
            title={_t("room_list|room|more_options")}
            showTitle={false}
            hasAccessibleAlternative={true}
            trigger={children}
            onOpenChange={onMenuOpenChange}
        >
            <MoreOptionContent state={state} callbacks={callbacks} />
        </ContextMenu>
    );
};
