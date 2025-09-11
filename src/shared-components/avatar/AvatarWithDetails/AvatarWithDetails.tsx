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
    roomName: string;
    avatar: React.ReactNode;
    details: React.ReactNode;
} & ComponentProps<C>;

/**
 * A component to display the body of a media message.
 *
 * @example
 * ```tsx
 * <MediaBody as="p" className="custom-class">Media body content</MediaBody>
 * ```
 */
export function AvatarWithDetails<C extends React.ElementType = "div">({
    as,
    className,
    details,
    avatar,
    roomName,
    ...props
}: PropsWithChildren<AvatarWithDetailsProps<C>>): JSX.Element {
    const Component = as || "div";

    // Keep Mx_MediaBody to support the compatibility with existing timeline and the all the layout
    return (
        <Component className={classNames(styles.avatarWithDetails, className)} {...props}>
            {avatar}
            <div>
                <span className={styles.room}>{roomName}</span>
                <span className={styles.details}>{details}</span>
            </div>
        </Component>
    );
}
