/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type HTMLAttributes, type JSX, memo } from "react";
import CheckIcon from "@vector-im/compound-design-tokens/assets/web/icons/check";

import styles from "./RichItem.module.css";
import { Flex } from "../../utils/Flex";
import { useI18n } from "../../utils/i18nContext";

export interface RichItemProps extends HTMLAttributes<HTMLLIElement> {
    /**
     * Avatar to display at the start of the item
     */
    avatar: React.ReactNode;
    /**
     * Title to display at the top of the item
     */
    title: string;
    /**
     * Description to display below the title
     */
    description: string;
    /**
     * Timestamp to display at the end of the item
     * The value is humanized (e.g. "5 minutes ago")
     */
    timestamp?: number;
    /**
     * Whether the item is selected
     * This will replace the avatar with a checkmark
     * @default false
     */
    selected?: boolean;
}

/**
 * A rich item to display in a list, with an avatar, title, description and optional timestamp.
 * If selected, the avatar is replaced with a checkmark.
 * A separator is added between items in a list.
 *
 * @example
 * ```tsx
 *   <RichItem
 *     avatar={<AvatarComponent />}
 *     title="Rich Item Title"
 *     description="This is a description of the rich item."
 *     timestamp={Date.now() - 5 * 60 * 1000} // 5 minutes ago
 *     selected={true}
 *     onClick={() => console.log("Item clicked")}
 *   />
 * ```
 */
export const RichItem = memo(function RichItem({
    avatar,
    title,
    description,
    timestamp,
    selected,
    ...props
}: RichItemProps): JSX.Element {
    const i18n = useI18n();

    return (
        <li
            className={styles.richItem}
            role="option"
            tabIndex={-1}
            aria-selected={selected}
            aria-label={title}
            {...props}
        >
            {selected ? <Checkmark /> : <Flex className={styles.avatar}>{avatar}</Flex>}
            <span className={styles.title}>{title}</span>
            <span className={styles.description}>{description}</span>
            {timestamp && (
                <span role="timer" className={styles.timestamp}>
                    {i18n.humanizeTime(timestamp)}
                </span>
            )}
        </li>
    );
});

/**
 * A checkmark icon inside a circle, used to indicate selection.
 */
function Checkmark(): JSX.Element {
    return (
        <Flex align="center" justify="center" aria-hidden="true" className={styles.checkmark}>
            <CheckIcon width="24px" height="24px" color="var(--cpd-color-icon-on-solid-primary)" />
        </Flex>
    );
}
