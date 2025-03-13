/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import AccessibleButton from "./AccessibleButton";
import { type ValidatedServerConfig } from "../../../utils/ValidatedServerConfig";
import { _t } from "../../../languageHandler";
import TextWithTooltip from "./TextWithTooltip";
import SdkConfig from "../../../SdkConfig";
import Modal from "../../../Modal";
import ServerPickerDialog from "../dialogs/ServerPickerDialog";
import InfoDialog from "../dialogs/InfoDialog";

interface IProps {
    title?: string;
    dialogTitle?: string;
    serverConfig: ValidatedServerConfig;
    disabled?: boolean;
    onServerConfigChange?(config: ValidatedServerConfig): void;
}

const showPickerDialog = (
    title: string | undefined,
    serverConfig: ValidatedServerConfig,
    onFinished: (config: ValidatedServerConfig) => void,
): void => {
    Modal.createDialog(ServerPickerDialog, { title, serverConfig, onFinished });
};

const onHelpClick = (): void => {
    const brand = SdkConfig.get().brand;
    Modal.createDialog(
        InfoDialog,
        {
            title: _t("auth|server_picker_title_default"),
            description: _t("auth|server_picker_description", { brand }),
            button: _t("action|dismiss"),
            hasCloseButton: false,
            fixedWidth: false,
        },
        "mx_ServerPicker_helpDialog",
    );
};

const ServerPicker: React.FC<IProps> = ({ title, dialogTitle, serverConfig, onServerConfigChange, disabled }) => {
    const disableCustomUrls = SdkConfig.get("disable_custom_urls");

    let editBtn;
    if (!disableCustomUrls && onServerConfigChange) {
        const onClick = (): void => {
            showPickerDialog(dialogTitle, serverConfig, (config?: ValidatedServerConfig) => {
                if (config) {
                    onServerConfigChange(config);
                }
            });
        };
        editBtn = (
            <AccessibleButton className="mx_ServerPicker_change" kind="link" onClick={onClick} disabled={disabled}>
                {_t("action|edit")}
            </AccessibleButton>
        );
    }

    let serverName: React.ReactNode = serverConfig.isNameResolvable ? serverConfig.hsName : serverConfig.hsUrl;
    if (serverConfig.hsNameIsDifferent) {
        serverName = (
            <TextWithTooltip className="mx_Login_underlinedServerName" tooltip={serverConfig.hsUrl}>
                {serverConfig.hsName}
            </TextWithTooltip>
        );
    }

    let desc;
    if (serverConfig.hsName === "matrix.org") {
        desc = <span className="mx_ServerPicker_desc">{_t("auth|server_picker_description_matrix.org")}</span>;
    }

    return (
        <div className="mx_ServerPicker">
            <h2>{title || _t("common|homeserver")}</h2>
            {!disableCustomUrls ? (
                <AccessibleButton
                    className="mx_ServerPicker_help"
                    onClick={onHelpClick}
                    aria-label={_t("common|help")}
                />
            ) : null}
            <span className="mx_ServerPicker_server" title={typeof serverName === "string" ? serverName : undefined}>
                {serverName}
            </span>
            {editBtn}
            {desc}
        </div>
    );
};

export default ServerPicker;
