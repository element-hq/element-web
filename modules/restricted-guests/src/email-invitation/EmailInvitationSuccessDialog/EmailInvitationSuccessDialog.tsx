/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type JSX } from "react";
import { I18nContext, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";
import type { DialogProps, Api } from "@element-hq/element-web-module-api";
import { EmailInvitationSuccessViewModel } from "./EmailInvitationSuccessViewModel";
import { EmailInvitationSuccessView } from "./EmailInvitationSuccessView";

interface EmailInvitationSuccessDialogProps extends DialogProps<void> {
    /** Module API */
    api: Api;
    /** The invited email addresses */
    emails: string[];
}

/**
 * Entry point of the dialog shown once the email invitations are sent.
 * Creates the view model and renders the view.
 *
 * @example
 * ```tsx
 * <EmailInvitationSuccessDialog api={api} emails={emails} onCancel={onCancel} onSubmit={onSubmit} />
 * ```
 */
export function EmailInvitationSuccessDialog({
    api,
    emails,
    onCancel,
}: Readonly<EmailInvitationSuccessDialogProps>): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(
        () => new EmailInvitationSuccessViewModel({ emails, closeDialog: onCancel }),
    );
    return (
        // The module bundles its own copy of shared-components, so the I18nContext provided by Element Web
        // is not visible here. Provide it again for shared components.
        <I18nContext.Provider value={api.i18n}>
            <EmailInvitationSuccessView vm={vm} api={api} />
        </I18nContext.Provider>
    );
}
