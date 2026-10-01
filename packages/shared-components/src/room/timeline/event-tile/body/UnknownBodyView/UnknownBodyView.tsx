/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import classNames from "classnames";
import React, { type JSX, type ReactNode, type Ref } from "react";

import styles from "./UnknownBodyView.module.css";

export interface UnknownBodyViewProps {
    /**
     * Fallback message body content.
     */
    text?: ReactNode;
    /**
     * Optional CSS class names applied to the root element.
     */
    className?: string;
    /**
     * Optional ref forwarded to the root element.
     */
    ref?: Ref<HTMLDivElement>;
}

/**
 * Renders fallback body content for unsupported message types.
 */
export function UnknownBodyView({ text, className, ref }: Readonly<UnknownBodyViewProps>): JSX.Element {
    return (
        <div className={classNames(styles.content, className)} ref={ref}>
            {text}
        </div>
    );
}
