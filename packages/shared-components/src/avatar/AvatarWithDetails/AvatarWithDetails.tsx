/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type ComponentProps, type ElementType, type JSX, type PropsWithChildren } from "react";
import React from "react";
import classNames from "classnames";

import styles from "./AvatarWithDetails.module.css";
import { Flex } from "../../utils/Flex";

export type AvatarWithDetailsProps<C extends ElementType> = {
    /**
     * The HTML tag.
     * @default "div"
     */
    as?: C;
    /**
     * The CSS class name.
     */
    className?: string;
    /**
     * The title/label next to the avatar. Usually the user or room name.
     */
    title: string;
    /**
     * A label with details to display under the avatar title.
     * Commonly used to display the number of participants in a room.
     */
    details: React.ReactNode;
    /** The avatar to display. */
    avatar: React.ReactNode;
} & ComponentProps<C>;

/**
 * A component to display an avatar with a title next to it in a grey box.
 *
 * @example
 * ```tsx
 * <AvatarWithDetails title="Room Name" details="10 participants" className="custom-class" />
 * ```
 */
export function AvatarWithDetails<C extends React.ElementType = "div">({
    as,
    className,
    details,
    avatar,
    title,
    ...props
}: PropsWithChildren<AvatarWithDetailsProps<C>>): JSX.Element {
    const Component = as || "div";

    return (
        <Component className={classNames(styles.avatarWithDetails, className)} {...props}>
            {avatar}
            <Flex direction="column">
                <span className={styles.title}>{title}</span>
                <span className={styles.details}>{details}</span>
            </Flex>
        </Component>
    );
}
