/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { IconButton, Text } from "@vector-im/compound-web";
import { CloseIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t, type UserStatus } from "..";
import styles from "./StatusPillView.module.css";

/**
 * Displays a user's status message in a pill format with a button that can be used
 * to clear the status.
 */
export const StatusPillView = React.forwardRef<
    HTMLDivElement,
    {
        status: UserStatus;
        clearStatus: () => void;
    } & React.HTMLAttributes<HTMLDivElement>
>(function StatusPillView({ status, clearStatus, ...props }, ref): JSX.Element {
    return (
        <div ref={ref} {...props} className={styles.statusPill}>
            <Text as="span" className={styles.menuStatusEmoji}>
                {status.emoji}
            </Text>
            <Text as="span" className={styles.menuStatusText}>
                {status.text}
            </Text>
            <IconButton
                onClick={clearStatus}
                aria-label={_t("menus|user_menu|clear_status")}
                tooltip={_t("menus|user_menu|clear_status")}
                size="28px"
            >
                <CloseIcon />
            </IconButton>
        </div>
    );
});
