/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type HTMLProps, type JSX, type PropsWithChildren, useId } from "react";
import classNames from "classnames";

import styles from "./RichList.module.css";
import { Flex } from "../../utils/Flex";
import { useListKeyboardNavigation } from "../../hooks/useListKeyboardNavigation";

export interface RichListProps extends HTMLProps<HTMLDivElement> {
    /**
     * Title to display at the top of the list
     */
    title: string;
    /**
     * Attributes to pass to the title element
     * This can be used to set accessibility attributes like `aria-level` or `role`
     * @example
     * ```tsx
     * <RichList title="My List" titleAttributes={{ role: "heading", "aria-level": 2 }}>
     * ```
     */
    titleAttributes?: HTMLProps<HTMLSpanElement>;
    /**
     * Indicates if the list should show an empty state.
     * The list renders its children in a span instead of an ul.
     */
    isEmpty?: boolean;
}

/**
 * A list component with a title and children.
 *
 * @example
 * ```tsx
 * <RichList title="My List">
 *   <RichItem ... />
 *   <RichItem ... />
 * </RichList>
 * ```
 */
export function RichList({
    children,
    title,
    className,
    titleAttributes,
    isEmpty = false,
    ...props
}: PropsWithChildren<RichListProps>): JSX.Element {
    const id = useId();
    const { listRef, onKeyDown, onFocus } = useListKeyboardNavigation();

    return (
        <Flex className={classNames(styles.richList, className)} direction="column" {...props}>
            <span id={id} className={styles.title} {...titleAttributes}>
                {title}
            </span>
            {isEmpty ? (
                <span className={styles.empty}>{children}</span>
            ) : (
                <ul
                    ref={listRef}
                    role="listbox"
                    className={styles.content}
                    aria-labelledby={id}
                    tabIndex={0}
                    onKeyDown={onKeyDown}
                    onFocus={onFocus}
                >
                    {children}
                </ul>
            )}
        </Flex>
    );
}
