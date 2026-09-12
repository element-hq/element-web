/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type ViewModel } from "../../../core/viewmodel";

/**
 * Why the last attempt to change the policy server failed.
 * - `lookup_failed`: the server name could not be resolved to a policy server (no or invalid `/.well-known/matrix/policy_server`).
 * - `update_failed`: the `m.room.policy` state event could not be sent.
 */
export type PolicyServerError = "lookup_failed" | "update_failed";

export interface PolicyServerViewSnapshot {
    /**
     * The server name currently entered in the input.
     */
    serverName: string;
    /**
     * The server name of the policy server the room currently uses, or an empty string when none is set.
     */
    currentServerName: string;
    /**
     * Whether the room is still configured with the unstable, pre-MSC4284 state event.
     * Applying the setting again migrates it to the stable `m.room.policy` event.
     */
    isLegacyConfig: boolean;
    /**
     * Whether the current user has permission to change the room's policy server.
     */
    canChange: boolean;
    /**
     * Whether the entered value can be applied right now.
     */
    canApply: boolean;
    /**
     * Whether a lookup or a state update is in progress.
     */
    busy: boolean;
    /**
     * The error from the last apply attempt, if any.
     */
    error: PolicyServerError | null;
    /**
     * The support page advertised by the current policy server, if it has one.
     */
    supportUrl: string | null;
}

export interface PolicyServerViewActions {
    /**
     * Update the server name entered in the input.
     */
    setServerName: (serverName: string) => void;
    /**
     * Look up the entered server name and set it as the room's policy server, or clear the
     * room's policy server when the input is empty.
     */
    apply: () => Promise<void>;
}

/**
 * The view model for the policy server settings form.
 */
export type PolicyServerViewModel = ViewModel<PolicyServerViewSnapshot, PolicyServerViewActions>;
