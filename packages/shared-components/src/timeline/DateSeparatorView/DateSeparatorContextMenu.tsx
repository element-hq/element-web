/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type PropsWithChildren } from "react";
import { Menu, MenuItem, Separator } from "@vector-im/compound-web";
import { capitalize } from "lodash";

import { useI18n } from "../../utils/i18nContext";
import { useViewModel } from "../../viewmodel";
import { humanizeRelativeTime } from "../../utils/humanize";
import { type DateSeparatorViewModel } from "./DateSeparatorView";
import { DateSeparatorDatePicker } from "./DateSeparatorDatePicker";

/**
 * Props for DateSeparatorContextMenu component.
 */
export interface DateSeparatorContextMenuProps {
    /** The date separator view model. */
    vm: DateSeparatorViewModel;
    /** Whether the menu is open (controlled by the parent). */
    open: boolean;
    /** Called when the menu requests an open state change. */
    onOpenChange?: (open: boolean) => void;
}

/**
 * Date separator jump-to menu.
 * Uses the wrapped child as the menu trigger.
 */
export const DateSeparatorContextMenu: React.FC<PropsWithChildren<DateSeparatorContextMenuProps>> = ({
    vm,
    open,
    onOpenChange,
    children,
}): JSX.Element => {
    const i18n = useI18n();
    const snapshot = useViewModel(vm);

    const onKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
        if (event.key !== "ArrowDown") return;
        event.preventDefault();

        const menu = event.currentTarget.closest('[role="menu"]');
        const input = menu?.querySelector<HTMLInputElement>('input[type="date"]');
        input?.focus();
    };

    return (
        <Menu
            open={open}
            onOpenChange={(newOpen) => {
                onOpenChange?.(newOpen);
            }}
            title={i18n.translate("room|jump_to_date")}
            showTitle={false}
            trigger={children}
            align="start"
        >
            <MenuItem
                label={capitalize(humanizeRelativeTime(i18n).format(-1, "week"))}
                onSelect={vm.onLastWeekPicked}
                data-testid="jump-to-date-last-week"
                hideChevron={true}
            />
            <MenuItem
                label={capitalize(humanizeRelativeTime(i18n).format(-1, "month"))}
                onSelect={vm.onLastMonthPicked}
                data-testid="jump-to-date-last-month"
                hideChevron={true}
            />
            <MenuItem
                label={i18n.translate("room|jump_to_date_beginning")}
                onSelect={vm.onBeginningPicked}
                data-testid="jump-to-date-beginning"
                hideChevron={true}
                onKeyDown={onKeyDown}
            />
            {snapshot.jumpToEnabled && <Separator decorative />}
            {snapshot.jumpToEnabled && (
                <MenuItem as="div" label={null} onSelect={null} hideChevron={true}>
                    <DateSeparatorDatePicker vm={vm} onSubmitted={() => onOpenChange?.(false)} />
                </MenuItem>
            )}
        </Menu>
    );
};
