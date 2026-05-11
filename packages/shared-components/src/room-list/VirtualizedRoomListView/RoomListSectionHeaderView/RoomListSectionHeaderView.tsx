/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { memo, type JSX, type FocusEvent, type MouseEventHandler, useState } from "react";
import ChevronRightIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-right";
import classNames from "classnames";
import { IconButton, Menu, MenuItem } from "@vector-im/compound-web";
import { OverflowHorizontalIcon, EditIcon, DeleteIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { useViewModel, type ViewModel } from "../../../core/viewmodel";
import styles from "./RoomListSectionHeaderView.module.css";
import { Flex } from "../../../core/utils/Flex";
import { useI18n } from "../../../core/i18n/i18nContext";
import { getGroupHeaderAccessibleProps } from "../../../core/VirtualizedList";
import { _t } from "../../../core/i18n/i18n";

/**
 * The observable state snapshot for a room list section header.
 */
export interface RoomListSectionHeaderViewSnapshot {
    /** Unique identifier for the section header (used for list keying) */
    id: string;
    /** The display title of the section header. */
    title: string;
    /** Whether the section is currently expanded. */
    isExpanded: boolean;
    /** Whether the section is unread (has any unread rooms) */
    isUnread: boolean;
    /** Wether to display the section menu  */
    displaySectionMenu: boolean;
}

/**
 * Actions that can be performed on a room list section header.
 */
export interface RoomListSectionHeaderActions {
    /** Handler invoked when the section header is clicked (toggles expand/collapse). */
    onClick: MouseEventHandler<HTMLButtonElement>;
    /** Handler invoked when the edit section button is clicked  */
    editSection: () => void;
    /** Handler invoked when the remove section button is clicked  */
    removeSection: () => void;
}

/**
 * The view model type for the room list section header, combining its snapshot and actions.
 */
export type RoomListSectionHeaderViewModel = ViewModel<RoomListSectionHeaderViewSnapshot, RoomListSectionHeaderActions>;

/**
 * Props for {@link RoomListSectionHeaderView}.
 */
export interface RoomListSectionHeaderViewProps {
    /** The view model driving the section header's state and actions. */
    vm: RoomListSectionHeaderViewModel;
    /** Whether this header currently has focus within the roving tab index. */
    isFocused: boolean;
    /** Callback invoked when the header receives focus. */
    onFocus: (headerId: string, e: FocusEvent) => void;
    /** Index of this section in the list, sections and rooms included */
    indexInList: number;
    /** Index of this section in the list related to the others sections */
    sectionIndex: number;
    /** Total number of sections in the list */
    sectionCount: number;
    /** Number of rooms in this section */
    roomCountInSection: number;
}

/**
 * A collapsible section header in the room list.
 *
 * Renders a button that displays the section title alongside a chevron icon
 * indicating the current expand/collapse state. Clicking the header toggles
 * the section's expanded state via the view model.
 *
 * @example
 * ```tsx
 * <RoomListSectionHeaderView
 *   vm={sectionHeaderViewModel}
 *   isFocused={isHeaderFocused}
 *   onFocus={() => setFocusedHeader(sectionId)}
 *   sectionIndex={index}
 *   sectionCount={totalSections}
 *   roomCountInSection={roomCount}
 * />
 * ```
 */
export const RoomListSectionHeaderView = memo(function RoomListSectionHeaderView({
    vm,
    isFocused,
    onFocus,
    indexInList,
    sectionIndex,
    sectionCount,
    roomCountInSection,
}: Readonly<RoomListSectionHeaderViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const { id, title, isExpanded, isUnread, displaySectionMenu } = useViewModel(vm);
    const isLastSection = sectionIndex === sectionCount - 1;

    return (
        <div
            aria-expanded={isExpanded}
            {...getGroupHeaderAccessibleProps(indexInList, sectionIndex, roomCountInSection)}
        >
            <button
                type="button"
                role="gridcell"
                className={classNames(styles.header, {
                    [styles.firstHeader]: sectionIndex === 0,
                    // If the section is collapsed and it's the last one
                    [styles.lastHeader]: !isExpanded && isLastSection,
                    [styles.unread]: isUnread,
                })}
                onClick={vm.onClick}
                aria-expanded={isExpanded}
                onFocus={(e) => onFocus(id, e)}
                tabIndex={isFocused ? 0 : -1}
                aria-label={
                    isUnread
                        ? _t("room_list|section_header|toggle_unread", { section: title })
                        : _t("room_list|section_header|toggle", { section: title })
                }
            >
                <Flex className={styles.container} align="center" justify="space-between" gap="var(--cpd-space-2x)">
                    <Flex align="center" gap="var(--cpd-space-0-5x)">
                        <ChevronRightIcon
                            className={styles.chevron}
                            width="24px"
                            height="24px"
                            fill="var(--cpd-color-icon-secondary)"
                        />
                        <span className={styles.title}>{title}</span>
                    </Flex>
                    {displaySectionMenu && <MenuComponent vm={vm} />}
                </Flex>
            </button>
        </div>
    );
});

interface MenuComponentProps {
    vm: RoomListSectionHeaderViewModel;
}

/**
 *
 * Menu component for the section header.
 */

function MenuComponent({ vm }: MenuComponentProps): JSX.Element {
    const [open, setOpen] = useState(false);

    return (
        <Menu
            open={open}
            onOpenChange={setOpen}
            title={_t("room_list|section_header|more_options")}
            showTitle={false}
            align="start"
            trigger={
                <IconButton
                    className={styles.menu}
                    tooltip={_t("room_list|section_header|more_options")}
                    aria-label={_t("room_list|section_header|more_options")}
                    size="24px"
                    style={{ padding: "2px" }}
                    color="var(--cpd-color-icon-primary)"
                >
                    <OverflowHorizontalIcon fill="var(--cpd-color-icon-primary)" />
                </IconButton>
            }
        >
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
            <div
                // We don't want keyboard navigation events to bubble up to the ListView changing the focused item
                onKeyDown={(e) => e.stopPropagation()}
            >
                <MenuItem
                    hideChevron={true}
                    Icon={EditIcon}
                    label={_t("room_list|section_header|edit_section")}
                    onSelect={() => vm.editSection()}
                    onClick={(evt) => evt.stopPropagation()}
                />
                <MenuItem
                    hideChevron={true}
                    Icon={DeleteIcon}
                    label={_t("room_list|section_header|remove_section")}
                    onSelect={() => vm.removeSection()}
                    onClick={(evt) => evt.stopPropagation()}
                />
            </div>
        </Menu>
    );
}
