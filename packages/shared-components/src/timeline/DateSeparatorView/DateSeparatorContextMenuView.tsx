/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type PropsWithChildren, useRef } from "react";
import { Menu, MenuItem, Separator } from "@vector-im/compound-web";
import { capitalize } from "lodash";

import { useI18n } from "../../utils/i18nContext";
import { humanizeRelativeTime } from "../../utils/humanize";
import { type DateSeparatorViewModel } from "./DateSeparatorView";
import { DateSeparatorDatePickerView } from "./DateSeparatorDatePickerView";
import styles from "./DateSeparatorContextMenuView.module.css";

/**
 * Props for DateSeparatorContextMenuView component.
 */
export interface DateSeparatorContextMenuViewProps {
    /** The date separator view model. */
    vm: DateSeparatorViewModel;
    /** Whether the menu is open (controlled by the parent). */
    open: boolean;
    /** The element used as the menu trigger. */
    trigger: React.ReactNode;
    /** Called when the menu requests an open state change. */
    onOpenChange?: (open: boolean) => void;
}

/**
 * Date separator jump-to menu.
 * Uses the wrapped child as the menu trigger.
 */
export const DateSeparatorContextMenuView: React.FC<PropsWithChildren<DateSeparatorContextMenuViewProps>> = ({
    vm,
    open,
    trigger,
    onOpenChange,
}): JSX.Element => {
    const i18n = useI18n();
    const { translate: _t } = useI18n();
    const dateInputRef = useRef<HTMLInputElement>(null);

    const onKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
        if (event.key !== "ArrowDown") return;
        event.preventDefault();
        dateInputRef.current?.focus();
    };

    return (
        <Menu
            open={open}
            onOpenChange={(newOpen) => {
                onOpenChange?.(newOpen);
            }}
            title={_t("room|jump_to_date")}
            showTitle={false}
            trigger={trigger}
            align="start"
            className={styles.picker_menu}
        >
            <MenuItem
                label={capitalize(humanizeRelativeTime(i18n).format(-1, "week"))}
                onSelect={() => vm.onLastWeekPicked?.()}
                data-testid="jump-to-date-last-week"
                hideChevron={true}
                className={styles.picker_menu_item}
            />
            <MenuItem
                label={capitalize(humanizeRelativeTime(i18n).format(-1, "month"))}
                onSelect={() => vm.onLastMonthPicked?.()}
                data-testid="jump-to-date-last-month"
                hideChevron={true}
                className={styles.picker_menu_item}
            />
            <MenuItem
                label={_t("room|jump_to_date_beginning")}
                onSelect={() => vm.onBeginningPicked?.()}
                data-testid="jump-to-date-beginning"
                hideChevron={true}
                className={styles.picker_menu_item}
                onKeyDown={onKeyDown}
            />
            <Separator decorative className={styles.picker_separator} />
            <DateSeparatorDatePickerView
                vm={vm}
                inputRef={dateInputRef}
                onSubmitted={() => onOpenChange?.(false)}
                onDismissed={() => onOpenChange?.(false)}
            />
        </Menu>
    );
};
