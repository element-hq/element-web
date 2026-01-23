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
    icon: JSX.Element;
    title: string;
    className?: string;
    timestamp?: JSX.Element;
    subtitle?: ReactNode;
    children?: JSX.Element;
    ref?: React.RefObject<any>;
}

export function EventTileBubble({ icon, title, className, timestamp, subtitle, children, ref }: EventTileBubbleProps): JSX.Element {
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
};
