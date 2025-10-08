/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";

import {
    type RoomListSectionHeader,
    RoomListSectionKey,
} from "../../../../stores/room-list-v3/skip-list/SectionProcessor.ts";
import { _t } from "../../../../shared-components/utils/i18n.tsx";

interface RoomListSectionHeaderViewProps extends React.HTMLAttributes<HTMLDivElement> {
    section: RoomListSectionHeader;
}

function sectionTitle(section: RoomListSectionKey): ReactNode {
    switch (section) {
        case RoomListSectionKey.Favourite:
            return _t("room_list|sections|favourite");
        case RoomListSectionKey.Unread:
            return _t("room_list|sections|unread");
        case RoomListSectionKey.Chat:
            return _t("room_list|sections|chat");
        case RoomListSectionKey.LowPriority:
            return _t("room_list|sections|low_priority");
    }
}

/**
 * An item in the room list
 */
export function RoomListSectionHeaderView({ section, ...props }: RoomListSectionHeaderViewProps): JSX.Element {
    return (
        <div className="mx_RoomListSectionHeaderView" {...props}>
            <h4>{sectionTitle(section.key)}</h4>
        </div>
    );
}
