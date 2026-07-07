/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { UserStatusIconView } from "@element-hq/web-shared-components";

import { useUserStatus } from "../hooks/useUserStatus";

interface Props {
    /**
     * The ID of the user whose status should be displayed.
     */
    userId: string;
}

/**
 * Fetches and displays the MSC4426 status emoji for a user, e.g. after their
 * display name in the user mention autocomplete. Renders nothing if the feature
 * is disabled or the user has no status.
 */
export function UserStatusIcon({ userId }: Props): JSX.Element | null {
    const status = useUserStatus(userId);
    if (!status) return null;
    return <UserStatusIconView status={status} />;
}
