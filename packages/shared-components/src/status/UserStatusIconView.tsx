/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Text, Tooltip } from "@vector-im/compound-web";

import { type ViewModel, useViewModel } from "../core/viewmodel";
import { type UserStatus } from "..";

/**
 * Snapshot for the UserStatusIconView.
 */
export interface UserStatusIconViewSnapshot {
    /**
     * The user's status, or undefined if not available.
     */
    status?: UserStatus;
}

/**
 * The view model for UserStatusIconView.
 */
export type UserStatusIconViewModel = ViewModel<UserStatusIconViewSnapshot>;

interface UserStatusIconViewProps {
    /**
     * The view model for the user status icon.
     */
    vm: UserStatusIconViewModel;
}

/**
 * Displays the MSC4426 status emoji for a user, e.g. after their display name
 * in the user mention autocomplete. Renders nothing if the user has no status.
 */
export function UserStatusIconView({ vm }: Readonly<UserStatusIconViewProps>): JSX.Element | null {
    const { status } = useViewModel(vm);
    if (!status) return null;
    return (
        <Tooltip description={status.text}>
            <Text as="span">{status.emoji}</Text>
        </Tooltip>
    );
}
