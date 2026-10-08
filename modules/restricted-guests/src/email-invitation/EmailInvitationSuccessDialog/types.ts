/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ViewModel } from "@element-hq/web-shared-components";

/** The state of the email invitation success dialog. */
export interface EmailInvitationSuccessViewSnapshot {
    /** The invited email addresses. */
    emails: string[];
}

/** The actions the email invitation success dialog can trigger. */
export interface EmailInvitationSuccessViewActions {
    /** Close the dialog. */
    closeDialog(): void;
}

/** View model of the email invitation success dialog. */
export type EmailInvitationSuccessViewModel = ViewModel<
    EmailInvitationSuccessViewSnapshot,
    EmailInvitationSuccessViewActions
>;
