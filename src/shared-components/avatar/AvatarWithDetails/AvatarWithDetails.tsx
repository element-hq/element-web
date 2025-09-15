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
    title: string;
    avatar: React.ReactNode;
    details: React.ReactNode;
} & ComponentProps<C>;

/**
 * A component to display the body of a media message.
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

    // Keep Mx_MediaBody to support the compatibility with existing timeline and the all the layout
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
