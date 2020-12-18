/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React from 'react';

import AccessibleButton from "./AccessibleButton";
import {ValidatedServerConfig} from "../../../utils/AutoDiscoveryUtils";
import {_t} from "../../../languageHandler";
import TextWithTooltip from "./TextWithTooltip";
import SdkConfig from "../../../SdkConfig";
import Modal from "../../../Modal";
import ServerPickerDialog from "../dialogs/ServerPickerDialog";
import InfoDialog from "../dialogs/InfoDialog";

interface IProps {
    title?: string;
    dialogTitle?: string;
    serverConfig: ValidatedServerConfig;
    onServerConfigChange?(config: ValidatedServerConfig): void;
}

const showPickerDialog = (
    title: string,
    serverConfig: ValidatedServerConfig,
    onFinished: (config: ValidatedServerConfig) => void,
) => {
    Modal.createTrackedDialog("Server Picker", "", ServerPickerDialog, { title, serverConfig, onFinished });
};

const onHelpClick = () => {
    Modal.createTrackedDialog('Custom Server Dialog', '', InfoDialog, {
        title: _t("Server Options"),
        description: _t("You can use the custom server options to sign into other Matrix servers by specifying " +
            "a different homeserver URL. This allows you to use Element with an existing Matrix account on " +
            "a different homeserver."),
        button: _t("Dismiss"),
        hasCloseButton: false,
        fixedWidth: false,
    }, "mx_ServerPicker_helpDialog");
};

const ServerPicker = ({ title, dialogTitle, serverConfig, onServerConfigChange }: IProps) => {
    let editBtn;
    if (!SdkConfig.get()["disable_custom_urls"] && onServerConfigChange) {
        const onClick = () => {
            showPickerDialog(dialogTitle, serverConfig, (config?: ValidatedServerConfig) => {
                if (config) {
                    onServerConfigChange(config);
                }
            });
        };
        editBtn = <AccessibleButton className="mx_ServerPicker_change" kind="link" onClick={onClick}>
            {_t("Edit")}
        </AccessibleButton>;
    }

    let serverName = serverConfig.isNameResolvable ? serverConfig.hsName : serverConfig.hsUrl;
    if (serverConfig.hsNameIsDifferent) {
        serverName = <TextWithTooltip class="mx_Login_underlinedServerName" tooltip={serverConfig.hsUrl}>
            {serverConfig.hsName}
        </TextWithTooltip>;
    }

    let desc;
    if (serverConfig.hsName === "matrix.org") {
        desc = <span className="mx_ServerPicker_desc">
            {_t("Join millions for free on the largest public server")}
        </span>;
    }

    return <div className="mx_ServerPicker">
        <h3>{title || _t("Homeserver")}</h3>
        <AccessibleButton className="mx_ServerPicker_help" onClick={onHelpClick} />
        <span className="mx_ServerPicker_server">{serverName}</span>
        { editBtn }
        { desc }
    </div>
}

export default ServerPicker;
