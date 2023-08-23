/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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
                {_t("You will be redirected to your server's authentication provider to complete sign out.")}
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
