/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import classNames from "classnames";
import React, { type JSX, useState } from "react";
import { Heading } from "@vector-im/compound-web";

import { type ViewModel } from "../../core/viewmodel/ViewModel";
import { useViewModel } from "../../core/viewmodel/useViewModel";
import styles from "./DateSeparatorView.module.css";
import { Flex } from "../../core/utils/Flex";
import { TimelineSeparator } from "../../message-body/TimelineSeparator";
import { DateSeparatorContextMenuView } from "./DateSeparatorContextMenuView";
import { DateSeparatorButton } from "./DateSeparatorButton";

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
     * Reference date as input format used to prefill the jump-to-date picker value.
     */
    jumpFromDate?: string;
}

export interface DateSeparatorViewActions {
    /** Optional: Jump to messages from the last week. */
    onLastWeekPicked?: () => void;
    /** Optional: Jump to messages from the last month. */
    onLastMonthPicked?: () => void;
    /** Optional: Jump to the beginning of the room history. */
    onBeginningPicked?: () => void;
    /** Optional: Jump to the picked date of the room history. */
    onDatePicked?: (date: string) => void;
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
    /**
     * Extra CSS classes to apply to the component.
     */
    className?: string;
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
export function DateSeparatorView({ vm, className }: Readonly<DateSeparatorViewProps>): JSX.Element {
    const { label, jumpToEnabled } = useViewModel(vm);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isTriggerHovered, setIsTriggerHovered] = useState(false);
    const [isTriggerFocused, setIsTriggerFocused] = useState(false);
    const onMenuOpenChange = (newOpen: boolean): void => {
        setIsMenuOpen(newOpen);
        if (newOpen) {
            setIsTriggerHovered(false);
            setIsTriggerFocused(false);
        }
    };

    if (jumpToEnabled) {
        return (
            <TimelineSeparator label={label} className={classNames(className)} role="none">
                <DateSeparatorContextMenuView
                    vm={vm}
                    open={isMenuOpen}
                    onOpenChange={onMenuOpenChange}
                    trigger={
                        <DateSeparatorButton
                            label={label}
                            tooltipOpen={!isMenuOpen && (isTriggerHovered || isTriggerFocused)}
                            className={styles.content}
                            onMouseEnter={() => setIsTriggerHovered(true)}
                            onMouseLeave={() => setIsTriggerHovered(false)}
                            onFocus={(event) => setIsTriggerFocused(event.currentTarget.matches(":focus-visible"))}
                            onBlur={() => setIsTriggerFocused(false)}
                        />
                    }
                />
            </TimelineSeparator>
        );
    }

    return (
        <TimelineSeparator label={label} className={classNames(className)}>
            <Flex className={styles.content}>
                <Heading as="h2" size="lg" aria-hidden="true">
                    {label}
                </Heading>
            </Flex>
        </TimelineSeparator>
    );
}
