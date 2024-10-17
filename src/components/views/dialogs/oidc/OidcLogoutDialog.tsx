/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { useState } from "react";

import { _t } from "../../../../languageHandler";
import BaseDialog from "../BaseDialog";
import { getOidcLogoutUrl } from "../../../../utils/oidc/getOidcLogoutUrl";
import AccessibleButton from "../../elements/AccessibleButton";

export interface OidcLogoutDialogProps {
    delegatedAuthAccountUrl: string;
    deviceId: string;
    onFinished(ok?: boolean): void;
}

/**
 * Handle logout of OIDC sessions other than the current session
 * - ask for user confirmation to open the delegated auth provider
 * - open the auth provider in a new tab
 * - wait for the user to return and close the modal, we assume the user has completed sign out of the session in auth provider UI
 *        and trigger a refresh of the session list
 */
export const OidcLogoutDialog: React.FC<OidcLogoutDialogProps> = ({
    delegatedAuthAccountUrl,
    deviceId,
    onFinished,
}) => {
    const [hasOpenedLogoutLink, setHasOpenedLogoutLink] = useState(false);
    const logoutUrl = getOidcLogoutUrl(delegatedAuthAccountUrl, deviceId);

    return (
        <BaseDialog onFinished={onFinished} title={_t("action|sign_out")} contentId="mx_Dialog_content">
            <div className="mx_Dialog_content" id="mx_Dialog_content">
                {_t("auth|oidc|logout_redirect_warning")}
            </div>
            <div className="mx_Dialog_buttons">
                {hasOpenedLogoutLink ? (
                    <AccessibleButton kind="primary" onClick={() => onFinished(true)}>
                        {_t("action|close")}
                    </AccessibleButton>
                ) : (
                    <>
                        <AccessibleButton kind="secondary" onClick={() => onFinished(false)}>
                            {_t("action|cancel")}
                        </AccessibleButton>
                        <AccessibleButton
                            element="a"
                            onClick={() => setHasOpenedLogoutLink(true)}
                            kind="primary"
                            href={logoutUrl}
                            target="_blank"
                        >
                            {_t("action|continue")}
                        </AccessibleButton>
                    </>
                )}
            </div>
        </BaseDialog>
    );
};
