/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import type ExportE2eKeysDialog from "../../../async-components/views/dialogs/security/ExportE2eKeysDialog";
import type ImportE2eKeysDialog from "../../../async-components/views/dialogs/security/ImportE2eKeysDialog";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import AccessibleButton from "../elements/AccessibleButton";
import * as FormattingUtils from "../../../utils/FormattingUtils";
import SettingsStore from "../../../settings/SettingsStore";
import SettingsFlag from "../elements/SettingsFlag";
import { SettingLevel } from "../../../settings/SettingLevel";
import SettingsSubsection, { SettingsSubsectionText } from "./shared/SettingsSubsection";

interface IProps {}

interface IState {}

export default class CryptographyPanel extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
    }

    public render(): React.ReactNode {
        const client = MatrixClientPeg.safeGet();
        const deviceId = client.deviceId;
        let identityKey = client.getDeviceEd25519Key();
        if (!identityKey) {
            identityKey = _t("encryption|not_supported");
        } else {
            identityKey = FormattingUtils.formatCryptoKey(identityKey);
        }

        let importExportButtons: JSX.Element | undefined;
        if (client.isCryptoEnabled()) {
            importExportButtons = (
                <div className="mx_CryptographyPanel_importExportButtons">
                    <AccessibleButton kind="primary_outline" onClick={this.onExportE2eKeysClicked}>
                        {_t("settings|security|export_megolm_keys")}
                    </AccessibleButton>
                    <AccessibleButton kind="primary_outline" onClick={this.onImportE2eKeysClicked}>
                        {_t("settings|security|import_megolm_keys")}
                    </AccessibleButton>
                </div>
            );
        }

        let noSendUnverifiedSetting: JSX.Element | undefined;
        if (SettingsStore.canSetValue("blacklistUnverifiedDevices", null, SettingLevel.DEVICE)) {
            noSendUnverifiedSetting = (
                <SettingsFlag
                    name="blacklistUnverifiedDevices"
                    level={SettingLevel.DEVICE}
                    onChange={this.updateBlacklistDevicesFlag}
                />
            );
        }

        return (
            <SettingsSubsection heading={_t("settings|security|cryptography_section")}>
                <SettingsSubsectionText>
                    <table className="mx_CryptographyPanel_sessionInfo">
                        <tr>
                            <th scope="row">{_t("settings|security|session_id")}</th>
                            <td>
                                <code>{deviceId}</code>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">{_t("settings|security|session_key")}</th>
                            <td>
                                <code>
                                    <b>{identityKey}</b>
                                </code>
                            </td>
                        </tr>
                    </table>
                </SettingsSubsectionText>
                {importExportButtons}
                {noSendUnverifiedSetting}
            </SettingsSubsection>
        );
    }

    private onExportE2eKeysClicked = (): void => {
        Modal.createDialogAsync(
            import("../../../async-components/views/dialogs/security/ExportE2eKeysDialog") as unknown as Promise<
                typeof ExportE2eKeysDialog
            >,
            { matrixClient: MatrixClientPeg.safeGet() },
        );
    };

    private onImportE2eKeysClicked = (): void => {
        Modal.createDialogAsync(
            import("../../../async-components/views/dialogs/security/ImportE2eKeysDialog") as unknown as Promise<
                typeof ImportE2eKeysDialog
            >,
            { matrixClient: MatrixClientPeg.safeGet() },
        );
    };

    private updateBlacklistDevicesFlag = (checked: boolean): void => {
        MatrixClientPeg.safeGet().setGlobalBlacklistUnverifiedDevices(checked);
    };
}
