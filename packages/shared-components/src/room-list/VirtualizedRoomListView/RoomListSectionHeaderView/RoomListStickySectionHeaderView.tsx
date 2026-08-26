/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { memo, type JSX } from "react";
import classNames from "classnames";

import { useViewModel } from "../../../core/viewmodel";
import styles from "./RoomListSectionHeaderView.module.css";
import { type RoomListSectionHeaderViewModel } from "./RoomListSectionHeaderView";
import { RoomListSectionHeaderContent } from "./RoomListSectionHeaderContent";

/**
 * Props for {@link RoomListStickySectionHeaderView}.
 */
export interface RoomListStickySectionHeaderViewProps {
    /** The view model for the section currently pinned at the top of the list. */
    vm: RoomListSectionHeaderViewModel;
    /** Whether this is the first section, so it can sit flush with the top edge like the real header. */
    isFirst: boolean;
}

/**
 * A clone of {@link RoomListSectionHeaderView} used as the pinned "current section" overlay at the
 * top of the virtualized room list.
 *
 * It is mouse-interactive — clicking toggles the section and hovering highlights it — but it is
 * hidden from assistive technology (`aria-hidden`) and removed from the tab order (`tabIndex={-1}`).
 * The real header rows inside the list remain the focusable, keyboard-navigable, screen-reader
 * elements, so the overlay is a mouse convenience that never duplicates anything for AT. It reuses
 * {@link RoomListSectionHeaderContent} so the chevron, title, notification decoration and section
 * menu stay identical to the real header; it only omits the real header's drag-and-drop wiring.
 */
export const RoomListStickySectionHeaderView = memo(function RoomListStickySectionHeaderView({
    vm,
    isFirst,
}: Readonly<RoomListStickySectionHeaderViewProps>): JSX.Element {
    const { isExpanded, isUnread } = useViewModel(vm);

    return (
        <div className={styles.stickyBackground} aria-hidden={true}>
            {/* `aria-expanded` is reused only to drive the chevron rotation via the shared CSS. */}
            <button
                type="button"
                className={classNames(styles.header, {
                    [styles.firstHeader]: isFirst,
                    [styles.unread]: isUnread,
                })}
                aria-expanded={isExpanded}
                onClick={vm.onClick}
                tabIndex={-1}
            >
                <RoomListSectionHeaderContent vm={vm} />
            </button>
        </div>
    );
});
