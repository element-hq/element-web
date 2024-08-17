/*
Copyright 2020-2021 The Matrix.org Foundation C.I.C.

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

import React from "react";

import AccessibleButton from "./AccessibleButton";
import { ValidatedServerConfig } from "../../../utils/ValidatedServerConfig";
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
