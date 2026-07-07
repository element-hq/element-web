/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Text, Tooltip } from "@vector-im/compound-web";

import { getUserStatusEmoji, type UserStatus } from "../core/userStatus";

export interface UserStatusIconViewProps extends React.HTMLAttributes<HTMLSpanElement> {
    /**
     * The user status to display.
     */
    status: UserStatus;
}

/**
 * Displays a user's MSC4426 status as its emoji only, with the status text shown
 * in a tooltip. Used where there is only room for the emoji, e.g. after a display
 * name in the user mention autocomplete or in a member tile.
 */
export function UserStatusIconView({ status, className, ...props }: UserStatusIconViewProps): JSX.Element {
    return (
        <Tooltip description={status.text}>
            <Text as="span" size="lg" className={className} {...props}>
                {getUserStatusEmoji(status)}
            </Text>
        </Tooltip>
    );
}
