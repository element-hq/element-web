/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type FC } from "react";
import { Text } from "@vector-im/compound-web";

import { type UserStatus } from "..";
import styles from "./StatusTextView.module.css";

/**
 * Displays a user's status message and emoji in simple text format
 */
export const StatusTextView: FC<
    {
        status: UserStatus;
        ref?: React.Ref<HTMLDivElement>;
    } & React.HTMLAttributes<HTMLDivElement>
> = function StatusTextView({ status, ref, ...props }): JSX.Element {
    return (
        <div ref={ref} {...props} className={styles.statusText}>
            <Text as="span" className={styles.menuStatusEmoji}>
                {status.emoji}
            </Text>
            <Text as="span" className={styles.menuStatusText}>
                {status.text}
            </Text>
        </div>
    );
};
