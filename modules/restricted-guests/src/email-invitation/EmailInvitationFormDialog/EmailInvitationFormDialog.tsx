/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type JSX } from "react";
import { I18nContext, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";
import { TooltipProvider } from "@vector-im/compound-web";
import type { DialogProps, Api, Room } from "@element-hq/element-web-module-api";
import { EmailInvitationFormViewModel } from "./EmailInvitationFormViewModel";
import { EmailInvitationFormView } from "./EmailInvitationFormView";
import type { ModuleConfig } from "../../config";
import type { EmailInvitationFormResult } from "./types";

interface EmailInvitationFormDialogProps extends DialogProps<EmailInvitationFormResult> {
    /** Module API */
    api: Api;
    /** The room to invite guests to */
    room: Room;
    /** Module configuration */
    config: ModuleConfig;
}

/**
 * Entry point of the email invitation dialog.
 * Creates the view model and renders the view.
 *
 * @example
 * ```tsx
 * <EmailInvitationFormDialog api={api} room={room} config={config} onCancel={onCancel} onSubmit={onSubmit} />
 * ```
 */
export function EmailInvitationFormDialog({
    api,
    config,
    room,
    onCancel,
    onSubmit,
}: Readonly<EmailInvitationFormDialogProps>): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(
        () => new EmailInvitationFormViewModel({ api, config, room, closeDialog: onCancel, onSubmit }),
    );
    return (
        // The module bundles its own copies of shared-components and compound-web, so the I18nContext and
        // TooltipProvider from Element Web are not visible here. Provide them again for Pill and Tooltip.
        <I18nContext.Provider value={api.i18n}>
            <TooltipProvider>
                <EmailInvitationFormView vm={vm} api={api} />
            </TooltipProvider>
        </I18nContext.Provider>
    );
}
