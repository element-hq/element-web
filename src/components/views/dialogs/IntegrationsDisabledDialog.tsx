/*
Copyright 2024, 2025 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback } from "react";

import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import { UserTab } from "./UserTab";

interface IProps {
    onFinished(): void;
}

export const IntegrationsDisabledDialog: React.FC<IProps> = ({ onFinished }) => {
    const onOpenSettingsClick = useCallback(() => {
        onFinished();
        dis.dispatch({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Security,
        });
    }, [onFinished]);

    return (
        <BaseDialog
            className="mx_IntegrationsDisabledDialog"
            hasCancel={true}
            onFinished={onFinished}
            title={_t("integrations|disabled_dialog_title")}
        >
            <div className="mx_IntegrationsDisabledDialog_content">
                <p>
                    {_t("integrations|disabled_dialog_description", {
                        manageIntegrations: _t("integration_manager|manage_title"),
                    })}
                </p>
            </div>
            <DialogButtons
                primaryButton={_t("common|settings")}
                onPrimaryButtonClick={onOpenSettingsClick}
                cancelButton={_t("action|ok")}
                onCancel={onFinished}
            />
        </BaseDialog>
    );
};
