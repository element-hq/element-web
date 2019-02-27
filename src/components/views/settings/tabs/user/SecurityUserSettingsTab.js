/*
Copyright 2019 New Vector Ltd

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
import PropTypes from 'prop-types';
import {_t} from "../../../../../languageHandler";
import {SettingLevel} from "../../../../../settings/SettingsStore";
import MatrixClientPeg from "../../../../../MatrixClientPeg";
import * as FormattingUtils from "../../../../../utils/FormattingUtils";
import AccessibleButton from "../../../elements/AccessibleButton";
import Analytics from "../../../../../Analytics";
import Promise from "bluebird";
import Modal from "../../../../../Modal";
import sdk from "../../../../..";

export class IgnoredUser extends React.Component {
    static propTypes = {
        userId: PropTypes.string.isRequired,
        onUnignored: PropTypes.func.isRequired,
    };

    _onUnignoreClicked = (e) => {
        this.props.onUnignored(this.props.userId);
    };

    render() {
        return (
            <div className='mx_SecurityUserSettingsTab_ignoredUser'>
                <AccessibleButton onClick={this._onUnignoreClicked} kind='primary_sm'>
                    {_t('Unignore')}
                </AccessibleButton>
                <span>{this.props.userId}</span>
            </div>
        );
    }
}

export default class SecurityUserSettingsTab extends React.Component {
    constructor() {
        super();

        this.state = {
            ignoredUserIds: MatrixClientPeg.get().getIgnoredUsers(),
            rejectingInvites: false,
        };
    }

    _updateBlacklistDevicesFlag = (checked) => {
        MatrixClientPeg.get().setGlobalBlacklistUnverifiedDevices(checked);
    };

    _updateAnalytics = (checked) => {
        checked ? Analytics.enable() : Analytics.disable();
    };

    _onExportE2eKeysClicked = () => {
        Modal.createTrackedDialogAsync('Export E2E Keys', '',
            import('../../../../../async-components/views/dialogs/ExportE2eKeysDialog'),
            {matrixClient: MatrixClientPeg.get()},
        );
    };

    _onImportE2eKeysClicked = () => {
        Modal.createTrackedDialogAsync('Import E2E Keys', '',
            import('../../../../../async-components/views/dialogs/ImportE2eKeysDialog'),
            {matrixClient: MatrixClientPeg.get()},
        );
    };

    _onUserUnignored = async (userId) => {
        // Don't use this.state to get the ignored user list as it might be
        // ever so slightly outdated. Instead, prefer to get a fresh list and
        // update that.
        const ignoredUsers = MatrixClientPeg.get().getIgnoredUsers();
        const index = ignoredUsers.indexOf(userId);
        if (index !== -1) {
            ignoredUsers.splice(index, 1);
            MatrixClientPeg.get().setIgnoredUsers(ignoredUsers);
        }
        this.setState({ignoredUsers});
    };

    _onRejectAllInvitesClicked = (rooms, ev) => {
        this.setState({
            rejectingInvites: true,
        });
        // reject the invites
        const promises = rooms.map((room) => {
            return MatrixClientPeg.get().leave(room.roomId).catch((e) => {
                // purposefully drop errors to the floor: we'll just have a non-zero number on the UI
                // after trying to reject all the invites.
            });
        });
        Promise.all(promises).then(() => {
            this.setState({
                rejectingInvites: false,
            });
        });
    };

    _renderCurrentDeviceInfo() {
        const SettingsFlag = sdk.getComponent('views.elements.SettingsFlag');

        const client = MatrixClientPeg.get();
        const deviceId = client.deviceId;
        let identityKey = client.getDeviceEd25519Key();
        if (!identityKey) {
            identityKey = _t("<not supported>");
        } else {
            identityKey = FormattingUtils.formatCryptoKey(identityKey);
        }

        let importExportButtons = null;
        if (client.isCryptoEnabled()) {
            importExportButtons = (
                <div className='mx_SecurityUserSettingsTab_importExportButtons'>
                    <AccessibleButton kind='primary' onClick={this._onExportE2eKeysClicked}>
                        {_t("Export E2E room keys")}
                    </AccessibleButton>
                    <AccessibleButton kind='primary' onClick={this._onImportE2eKeysClicked}>
                        {_t("Import E2E room keys")}
                    </AccessibleButton>
                </div>
            );
        }

        return (
            <div className='mx_SettingsTab_section'>
                <span className='mx_SettingsTab_subheading'>{_t("Cryptography")}</span>
                <ul className='mx_SettingsTab_subsectionText mx_SecurityUserSettingsTab_deviceInfo'>
                    <li>
                        <label>{_t("Device ID:")}</label>
                        <span><code>{deviceId}</code></span>
                    </li>
                    <li>
                        <label>{_t("Device key:")}</label>
                        <span><code><b>{identityKey}</b></code></span>
                    </li>
                </ul>
                {importExportButtons}
                <SettingsFlag name='blacklistUnverifiedDevices' level={SettingLevel.DEVICE}
                              onChange={this._updateBlacklistDevicesFlag} />
            </div>
        );
    }

    _renderIgnoredUsers() {
        if (!this.state.ignoredUserIds || this.state.ignoredUserIds.length === 0) return null;

        const userIds = this.state.ignoredUserIds
            .map((u) => <IgnoredUser userId={u} onUnignored={this._onUserUnignored} key={u} />);

        return (
            <div className='mx_SettingsTab_section'>
                <span className='mx_SettingsTab_subheading'>{_t('Ignored users')}</span>
                <div className='mx_SettingsTab_subsectionText'>
                    {userIds}
                </div>
            </div>
        );
    }

    _renderRejectInvites() {
        const invitedRooms = MatrixClientPeg.get().getRooms().filter((r) => {
            return r.hasMembershipState(MatrixClientPeg.get().getUserId(), "invite");
        });
        if (invitedRooms.length === 0) {
            return null;
        }

        const onClick = this._onRejectAllInvitesClicked.bind(this, invitedRooms);
        return (
            <div className='mx_SettingsTab_section'>
                <span className='mx_SettingsTab_subheading'>{_t('Bulk options')}</span>
                <AccessibleButton onClick={onClick} kind='danger' disabled={this.state.rejectingInvites}>
                    {_t("Reject all %(invitedRooms)s invites", {invitedRooms: invitedRooms.length})}
                </AccessibleButton>
            </div>
        );
    }

    render() {
        const DevicesPanel = sdk.getComponent('views.settings.DevicesPanel');
        const SettingsFlag = sdk.getComponent('views.elements.SettingsFlag');

        const KeyBackupPanel = sdk.getComponent('views.settings.KeyBackupPanel');
        const keyBackup = (
            <div className='mx_SettingsTab_section'>
                <span className="mx_SettingsTab_subheading">{_t("Key backup")}</span>
                <div className='mx_SettingsTab_subsectionText'>
                    <KeyBackupPanel />
                </div>
            </div>
        );

        return (
            <div className="mx_SettingsTab mx_SecurityUserSettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Security & Privacy")}</div>
                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{_t("Devices")}</span>
                    <div className='mx_SettingsTab_subsectionText'>
                        <DevicesPanel />
                    </div>
                </div>
                {keyBackup}
                {this._renderCurrentDeviceInfo()}
                <div className='mx_SettingsTab_section'>
                    <span className="mx_SettingsTab_subheading">{_t("Analytics")}</span>
                    <div className='mx_SettingsTab_subsectionText'>
                        {_t("Riot collects anonymous analytics to allow us to improve the application.")}
                        &nbsp;
                        {_t("Privacy is important to us, so we don't collect any personal or " +
                            "identifiable data for our analytics.")}
                        <AccessibleButton className="mx_SettingsTab_linkBtn" onClick={Analytics.showDetailsModal}>
                            {_t("Learn more about how we use analytics.")}
                        </AccessibleButton>
                    </div>
                    <SettingsFlag name='analyticsOptIn' level={SettingLevel.DEVICE}
                                  onChange={this._updateAnalytics} />
                </div>
                {this._renderIgnoredUsers()}
                {this._renderRejectInvites()}
            </div>
        );
    }
}
