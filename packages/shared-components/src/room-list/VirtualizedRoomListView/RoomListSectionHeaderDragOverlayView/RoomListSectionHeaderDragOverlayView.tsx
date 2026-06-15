/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { memo, type JSX } from "react";
import classNames from "classnames";

import { type RoomListSectionHeaderViewModel } from "../RoomListSectionHeaderView";
import { RoomListSectionHeaderContent } from "../RoomListSectionHeaderView/RoomListSectionHeaderContent";
import headerStyles from "../RoomListSectionHeaderView/RoomListSectionHeaderView.module.css";
import styles from "./RoomListSectionHeaderDragOverlayView.module.css";

/**
 * Props for {@link RoomListSectionHeaderDragOverlayView}.
 */
export interface RoomListSectionHeaderDragOverlayViewProps {
    /** The section header view model — same one used by the real section header */
    vm: RoomListSectionHeaderViewModel;
}

/**
 * Visual clone of a section header rendered inside the dnd drag overlay.
 *
 * Reuses {@link RoomListSectionHeaderContent} for the inner layout so the
 * floating clone matches a real section header.
 */
export const RoomListSectionHeaderDragOverlayView = memo(function RoomListSectionHeaderDragOverlayView({
    vm,
}: RoomListSectionHeaderDragOverlayViewProps): JSX.Element {
    return (
        // Purely a visual clone that follows the drag. Hide it from the accessibility tree so the
        // dragged section's title isn't duplicated (the real, still-focused header already exposes
        // it, and drag feedback is narrated via the dnd live-region announcements).
        <div aria-hidden={true} className={classNames(headerStyles.header, styles.dragOverlay)}>
            <RoomListSectionHeaderContent vm={vm} isDragging={true} />
        </div>
    );
});
