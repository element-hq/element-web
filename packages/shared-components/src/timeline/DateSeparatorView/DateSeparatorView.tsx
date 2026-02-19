/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import classNames from "classnames";
import React, { type JSX, useState } from "react";
import { Tooltip } from "@vector-im/compound-web";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";

import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../viewmodel/useViewModel";
import styles from "./DateSeparatorView.module.css";
import { Flex } from "../../utils/Flex";
import { useI18n } from "../../utils/i18nContext";
import { TimelineSeparator } from "../../message-body/TimelineSeparator";
import { DateSeparatorContextMenu } from "./DateSeparatorContextMenu";

export interface DateSeparatorViewSnapshot {
    /**
     * Visible date label and the separator's accessible label.
     */
    label: string;
    /**
     * Controls whether the jump-to menu is rendered.
     */
    jumpToEnabled?: boolean;
    /**
     * Reference timestamp used to prefill the jump-to-date picker value.
     */
    jumpToTimstamp?: number;
    /**
     * Extra CSS classes to apply to the component.
     */
    className?: string;
}

export interface DateSeparatorViewActions {
    /** Jump to messages from the last week. */
    onLastWeekPicked: () => void;
    /** Jump to messages from the last month. */
    onLastMonthPicked: () => void;
    /** Jump to the beginning of the room history. */
    onBeginningPicked: () => void;
    /** Jump to the picked date of the room history. */
    onDatePicked: (dateString: string) => void;
}

/**
 * The view model for the component.
 */
export type DateSeparatorViewModel = ViewModel<DateSeparatorViewSnapshot> & DateSeparatorViewActions;

interface DateSeparatorViewProps {
    /**
     * The view model for the component.
     */
    vm: DateSeparatorViewModel;
}

/**
 * Renders a timeline date separator.
 * When `jumpToEnabled` is true, wraps the separator label with a jump-to menu trigger.
 * The tooltip is disabled while the menu is open to avoid overlap.
 *
 * @example
 * ```tsx
 * <DateSeparatorView vm={vm} />
 * ```
 */
export function DateSeparatorView({ vm }: Readonly<DateSeparatorViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const { label, className, jumpToEnabled } = useViewModel(vm);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    let content = (
        <Flex className={styles.content}>
            <h2 aria-hidden="true">{label}</h2>
        </Flex>
    );

    if (jumpToEnabled) {
        content = (
            <Tooltip
                description={_t("room|jump_to_date")}
                placement="right"
                isTriggerInteractive={false}
                nonInteractiveTriggerTabIndex={-1}
                disabled={isMenuOpen}
            >
                <DateSeparatorContextMenu vm={vm} open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                    <Flex
                        data-testid="jump-to-date-separator-button"
                        className={classNames(styles.content)}
                        aria-live="off"
                        aria-label={_t("room|jump_to_date")}
                        role="button"
                        tabIndex={0}
                    >
                        <h2 aria-hidden="true">{label}</h2>
                        <ChevronDownIcon />
                    </Flex>
                </DateSeparatorContextMenu>
            </Tooltip>
        );
    }

    return (
        <TimelineSeparator label={label} className={classNames(className)} role={jumpToEnabled ? "none" : "separator"}>
            {content}
        </TimelineSeparator>
    );
}
