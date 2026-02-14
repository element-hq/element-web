/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export const INVITE_RULES_ACCOUNT_DATA_TYPE = "org.matrix.msc4155.invite_permission_config";

export interface InviteConfigAccountData {
    allowed_users?: string[];
    blocked_users?: string[];
    ignored_users?: string[];
    allowed_servers?: string[];
    blocked_servers?: string[];
    ignored_servers?: string[];
}

/**
 * Computed values based on MSC4155. Currently Element Web only supports
 * blocking all invites.
 */
export interface ComputedInviteConfig extends Record<string, unknown> {
    /**
     * Are all invites blocked. This is only about blocking all invites,
     * but this being false may still block invites through other rules.
     */
    allBlocked: boolean;
}
