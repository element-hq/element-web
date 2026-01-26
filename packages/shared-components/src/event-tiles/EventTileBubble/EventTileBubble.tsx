/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";
import classNames from "classnames";

import styles from "./EventTileBubble.module.css";

export interface EventTileBubbleProps {
    /**
     * Icon rendered at the start of the bubble.
     */
    icon: JSX.Element;
    /**
     * Main title text for the bubble.
     */
    title: string;
    /**
     * Optional subtitle rendered beneath the title.
     */
    subtitle?: ReactNode;
    /**
     * Optional extra class name for the container.
     */
    className?: string;
    /**
     * Optional timestamp element rendered at the end of the bubble.
     */
    timestamp?: JSX.Element;
    /**
     * Optional children rendered between subtitle and timestamp.
     */
    children?: JSX.Element;
    /**
     * Forwarded ref for the container element.
     */
    ref?: React.RefObject<any>;
}

/**
 * EventTileBubble renders a compact event tile with an icon, title, and optional subtitle/content.
 *
 * @example
 * ```tsx
 * <EventTileBubble icon={<Icon />} title="Room created"} />
 * ```
 */
export function EventTileBubble({
    icon,
    title,
    subtitle,
    className,
    timestamp,
    children,
    ref,
}: EventTileBubbleProps): JSX.Element {
    // Keep mx_EventTileBubble to support the compatibility with existing timeline and the all the layout
    return (
        <div className={classNames("mx_EventTileBubble", styles.container, className)} ref={ref}>
            {icon}
            <div className={styles.title}>{title}</div>
            {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
            {children}
            {timestamp}
        </div>
    );
}
