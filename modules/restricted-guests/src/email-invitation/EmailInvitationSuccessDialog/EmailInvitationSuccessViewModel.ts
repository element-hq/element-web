/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BaseViewModel } from "@element-hq/web-shared-components";
import type { EmailInvitationSuccessViewActions, EmailInvitationSuccessViewSnapshot } from "./types";

interface EmailInvitationSuccessViewModelProps {
    /** The invited email addresses */
    emails: string[];
    /** Close the dialog */
    closeDialog: () => void;
}

/**
 * View model of the email invitation success dialog.
 */
export class EmailInvitationSuccessViewModel
    extends BaseViewModel<EmailInvitationSuccessViewSnapshot, EmailInvitationSuccessViewModelProps>
    implements EmailInvitationSuccessViewActions
{
    public constructor(props: EmailInvitationSuccessViewModelProps) {
        super(props, { emails: props.emails });
    }

    public closeDialog = (): void => {
        this.props.closeDialog();
    };
}
