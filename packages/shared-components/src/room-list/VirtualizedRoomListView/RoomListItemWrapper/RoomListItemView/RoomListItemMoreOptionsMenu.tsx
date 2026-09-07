/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { IconButton, Menu, MenuItem, Separator, SubMenu, ToggleMenuItem } from "@vector-im/compound-web";
import {
    MarkAsReadIcon,
    MarkAsUnreadIcon,
    FavouriteIcon,
    ArrowDownIcon,
    UserAddIcon,
    LinkIcon,
    LeaveIcon,
    OverflowHorizontalIcon,
    ArrowRightIcon,
    CheckIcon,
    MinusIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../../core/i18n/i18n";
import { useViewModel, type ViewModel } from "../../../../core/viewmodel";
import type { RoomListItemViewSnapshot, RoomListItemViewActions } from "./RoomListItemView";
import styles from "./RoomListItemMoreOptionsMenu.module.css";

/**
 * View model type for room list item
 */
export type RoomListItemViewModel = ViewModel<RoomListItemViewSnapshot, RoomListItemViewActions>;

/**
 * Props for RoomListItemMoreOptionsMenu component
 */
export interface RoomListItemMoreOptionsMenuProps {
    /** The room item view model */
    vm: RoomListItemViewModel;
}

/**
 * Grace period, in milliseconds, allowed for the pointer to travel from the
 * submenu's trigger into the submenu itself before the submenu is dismissed.
 */
const HOVER_DISMISS_GRACE_MS = 300;

interface SubMenuHoverDismiss {
    /** Whether the submenu is open. */
    open: boolean;
    /** Handler for the submenu's own open state changes. */
    onOpenChange: (open: boolean) => void;
    /** `onPointerLeave` for the submenu's trigger. */
    onTriggerPointerLeave: React.PointerEventHandler;
    /** `onPointerOver` for the submenu's contents. */
    onContentPointerOver: React.PointerEventHandler;
}

/**
 * Dismisses an open submenu when the mouse wanders away from it, without
 * dismissing the parent menu.
 *
 * Radix dismisses a submenu when the pointer reaches a sibling menu item or
 * leaves the menu altogether, but not when it lands on parent-menu space that
 * is not an item — the gap between items, or the padding — which is what
 * leaves the submenu stranded on screen.
 *
 * The behaviour implemented here is the standard cascade-menu pattern:
 *
 * - If the mouse never made it into the submenu, treat the open as accidental
 *   and dismiss the submenu shortly after the mouse leaves the trigger.
 * - Once the mouse has been over an item of the submenu, the user has shown
 *   intent, so keep it open until they explicitly dismiss it.
 *
 * Dismissal is only ever driven by a mouse, so submenus opened by keyboard or
 * touch are left alone rather than disappearing from under a user who cannot
 * chase them with a pointer.
 */
function useSubMenuHoverDismiss(): SubMenuHoverDismiss {
    const [open, setOpen] = useState(false);

    // Whether the mouse has been inside the submenu during this open cycle.
    // Once it has, hovering out no longer dismisses the submenu.
    const hasEnteredContent = useRef(false);
    const dismissTimer = useRef<number | undefined>(undefined);

    const clearDismissTimer = useCallback((): void => {
        if (dismissTimer.current !== undefined) {
            window.clearTimeout(dismissTimer.current);
            dismissTimer.current = undefined;
        }
    }, []);

    // Start each open cycle with a clean slate.
    useEffect(() => {
        if (!open) {
            hasEnteredContent.current = false;
            clearDismissTimer();
        }
    }, [open, clearDismissTimer]);

    useEffect(() => clearDismissTimer, [clearDismissTimer]);

    const onTriggerPointerLeave = useCallback<React.PointerEventHandler>(
        (event) => {
            if (event.pointerType !== "mouse") return;
            // The trigger stays mounted while the submenu is closed, so
            // leaving it is routine and means nothing.
            if (!open) return;
            // The user has already committed to the submenu; leave it be.
            if (hasEnteredContent.current) return;
            clearDismissTimer();
            dismissTimer.current = window.setTimeout(() => {
                dismissTimer.current = undefined;
                if (!hasEnteredContent.current) setOpen(false);
            }, HOVER_DISMISS_GRACE_MS);
        },
        [open, clearDismissTimer],
    );

    const onContentPointerOver = useCallback<React.PointerEventHandler>(
        (event) => {
            if (event.pointerType !== "mouse") return;
            hasEnteredContent.current = true;
            clearDismissTimer();
        },
        [clearDismissTimer],
    );

    return { open, onOpenChange: setOpen, onTriggerPointerLeave, onContentPointerOver };
}

/**
 * The more options menu for room list items.
 * Displays additional room actions like mark as read/unread, favorite, invite, etc.
 */
export function RoomListItemMoreOptionsMenu({ vm }: RoomListItemMoreOptionsMenuProps): JSX.Element {
    const [open, setOpen] = useState(false);

    return (
        <Menu
            open={open}
            onOpenChange={setOpen}
            title={_t("room_list|room|more_options")}
            showTitle={false}
            align="start"
            trigger={
                <IconButton
                    tooltip={_t("room_list|room|more_options")}
                    aria-label={_t("room_list|room|more_options")}
                    size="24px"
                    style={{ padding: "2px" }}
                >
                    <OverflowHorizontalIcon />
                </IconButton>
            }
        >
            <MoreOptionContent vm={vm} />
        </Menu>
    );
}

interface MoreOptionContentProps {
    vm: RoomListItemViewModel;
}

export function MoreOptionContent({ vm }: MoreOptionContentProps): JSX.Element {
    const snapshot = useViewModel(vm);
    const hasSections = snapshot.sections.length > 0;
    const isInSection = useMemo(() => snapshot.sections.some((section) => section.isSelected), [snapshot.sections]);

    const {
        open: moveToOpen,
        onOpenChange: onMoveToOpenChange,
        onTriggerPointerLeave: onMoveToTriggerPointerLeave,
        onContentPointerOver: onMoveToContentPointerOver,
    } = useSubMenuHoverDismiss();

    return (
        <div onKeyDown={(e) => e.stopPropagation()}>
            {snapshot.canMarkAsRead && (
                <MenuItem
                    Icon={MarkAsReadIcon}
                    label={_t("room_list|more_options|mark_read")}
                    onSelect={vm.onMarkAsRead}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            {snapshot.canMarkAsUnread && (
                <MenuItem
                    Icon={MarkAsUnreadIcon}
                    label={_t("room_list|more_options|mark_unread")}
                    onSelect={vm.onMarkAsUnread}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            <ToggleMenuItem
                checked={snapshot.isFavourite}
                Icon={FavouriteIcon}
                label={_t("room_list|more_options|favourited")}
                onSelect={vm.onToggleFavorite}
                onClick={(evt) => evt.stopPropagation()}
            />
            <ToggleMenuItem
                checked={snapshot.isLowPriority}
                Icon={ArrowDownIcon}
                label={_t("room_list|more_options|low_priority")}
                onSelect={vm.onToggleLowPriority}
                onClick={(evt) => evt.stopPropagation()}
            />
            <Separator />
            {snapshot.canInvite && (
                <MenuItem
                    Icon={UserAddIcon}
                    label={_t("action|invite")}
                    onSelect={vm.onInvite}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            {snapshot.canCopyRoomLink && (
                <MenuItem
                    Icon={LinkIcon}
                    label={_t("room_list|more_options|copy_link")}
                    onSelect={vm.onCopyRoomLink}
                    onClick={(evt) => evt.stopPropagation()}
                    hideChevron={true}
                />
            )}
            {snapshot.areSectionsEnabled && (
                <>
                    <SubMenu
                        open={moveToOpen}
                        onOpenChange={onMoveToOpenChange}
                        trigger={
                            <MenuItem
                                Icon={ArrowRightIcon}
                                label={_t("room_list|more_options|move_to_section")}
                                onSelect={null}
                                onPointerLeave={onMoveToTriggerPointerLeave}
                            />
                        }
                    >
                        {/* `display: contents` leaves layout untouched; `pointerover`
                            from the items below still bubbles through it. */}
                        <div style={{ display: "contents" }} onPointerOver={onMoveToContentPointerOver}>
                            {snapshot.sections.map((section) => (
                                <MenuItem
                                    key={section.tag}
                                    label={section.name}
                                    labelProps={{
                                        className: styles.sectionLabel,
                                    }}
                                    onSelect={() => vm.onToggleSection(section.tag)}
                                    onClick={(evt) => evt.stopPropagation()}
                                    hideChevron={true}
                                    aria-checked={section.isSelected}
                                >
                                    {section.isSelected && (
                                        <CheckIcon color="var(--cpd-color-icon-tertiary)" width="24px" height="24px" />
                                    )}
                                </MenuItem>
                            ))}
                            {hasSections && <Separator />}
                            <MenuItem
                                label={_t("action|new_section")}
                                onSelect={vm.onCreateSection}
                                hideChevron={true}
                            />
                        </div>
                    </SubMenu>
                    {isInSection && (
                        <MenuItem
                            Icon={MinusIcon}
                            label={_t("room_list|more_options|remove_from_section")}
                            onSelect={vm.onRemoveFromSection}
                            onClick={(evt) => evt.stopPropagation()}
                            hideChevron={true}
                        />
                    )}
                </>
            )}
            <Separator />
            <MenuItem
                kind="critical"
                Icon={LeaveIcon}
                label={_t("room_list|more_options|leave_room")}
                onSelect={vm.onLeaveRoom}
                onClick={(evt) => evt.stopPropagation()}
                hideChevron={true}
            />
        </div>
    );
}
