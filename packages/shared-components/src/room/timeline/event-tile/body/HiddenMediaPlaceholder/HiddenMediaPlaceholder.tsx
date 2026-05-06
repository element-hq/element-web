/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import classNames from "classnames";
import React, { type JSX, type MouseEventHandler, type PropsWithChildren } from "react";
import { VisibilityOnIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import styles from "./HiddenMediaPlaceholder.module.css";

export type HiddenMediaPlaceholderProps = PropsWithChildren<{
    /**
     * CSS class names applied to the root button.
     */
    className?: string;
    /**
     * Invoked when the user chooses to reveal the hidden media.
     */
    onClick: MouseEventHandler<HTMLButtonElement>;
}>;

/**
 * Renders a full-frame button used to reveal hidden media previews.
 */
export function HiddenMediaPlaceholder({
    className,
    onClick,
    children,
}: Readonly<HiddenMediaPlaceholderProps>): JSX.Element {
    return (
        <button type="button" onClick={onClick} className={classNames(styles.button, className)}>
            <span className={styles.content}>
                <VisibilityOnIcon className={styles.icon} aria-hidden="true" />
                <span>{children}</span>
            </span>
        </button>
    );
}
