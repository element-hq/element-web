/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import classNames from "classnames";
import { Text } from "@vector-im/compound-web";

import { getUserStatusEmoji, type UserStatus } from "../core/userStatus";
import styles from "./UserStatusMessageView.module.css";

export interface UserStatusMessageViewProps extends React.HTMLAttributes<HTMLSpanElement> {
    /**
     * The user status to display.
     */
    status: UserStatus;
}

/**
 * Displays a user's MSC4426 status as its emoji followed by the status text,
 * e.g. next to the room name in a DM room header or under the name in a user profile.
 */
export function UserStatusMessageView({ status, className, ...props }: UserStatusMessageViewProps): JSX.Element {
    return (
        <span {...props} className={classNames(styles.userStatusMessage, className)}>
            <Text as="span" size="lg" className={styles.userStatusMessage_emoji}>
                {getUserStatusEmoji(status)}
            </Text>
            <Text as="span" size="md" weight="medium" className={styles.userStatusMessage_text}>
                {status.text}
            </Text>
        </span>
    );
}
