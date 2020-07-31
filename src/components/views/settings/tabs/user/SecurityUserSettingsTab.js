/*
Copyright 2019 New Vector Ltd
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
import PropTypes from 'prop-types';
import {_t} from "../../../../../languageHandler";
import SdkConfig from "../../../../../SdkConfig";
import {MatrixClientPeg} from "../../../../../MatrixClientPeg";
import * as FormattingUtils from "../../../../../utils/FormattingUtils";
import AccessibleButton from "../../../elements/AccessibleButton";
import Analytics from "../../../../../Analytics";
import Modal from "../../../../../Modal";
import * as sdk from "../../../../..";
import {sleep} from "../../../../../utils/promise";
import dis from "../../../../../dispatcher/dispatcher";
import {privateShouldBeEncrypted} from "../../../../../createRoom";
import {SettingLevel} from "../../../../../settings/SettingLevel";

export class IgnoredUser extends React.Component {
    static propTypes = {
        userId: PropTypes.string.isRequired,
        onUnignored: PropTypes.func.isRequired,
        inProgress: PropTypes.bool.isRequired,
    };

    _onUnignoreClicked = (e) => {
        this.props.onUnignored(this.props.userId);
    };

    render() {
        const id = `mx_SecurityUserSettingsTab_ignoredUser_${this.props.userId}`;
        return (
            <div className='mx_SecurityUserSettingsTab_ignoredUser'>
                <AccessibleButton onClick={this._onUnignoreClicked} kind='primary_sm' aria-describedby={id} disabled={this.props.inProgress}>
                    { _t('Unignore') }
                </AccessibleButton>
                <span id={id}>{ this.props.userId }</span>
            </div>
        );
    }
}

export default class SecurityUserSettingsTab extends React.Component {
    static propTypes = {
        closeSettingsFn: PropTypes.func.isRequired,
    };

    constructor() {
        super();

        // Get number of rooms we're invited to
        const invitedRooms = this._getInvitedRooms();

        this.state = {
            ignoredUserIds: MatrixClientPeg.get().getIgnoredUsers(),
            waitingUnignored: [],
            managingInvites: false,
            invitedRoomAmt: invitedRooms.length,
        };

        this._onAction = this._onAction.bind(this);
    }


    _onAction({action}) {
        if (action === "ignore_state_changed") {
            const ignoredUserIds = MatrixClientPeg.get().getIgnoredUsers();
            const newWaitingUnignored = this.state.waitingUnignored.filter(e=> ignoredUserIds.includes(e));
            this.setState({ignoredUserIds, waitingUnignored: newWaitingUnignored});
        }
    }

    componentDidMount() {
        this.dispatcherRef = dis.register(this._onAction);
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
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

    _onGoToUserProfileClick = () => {
        dis.dispatch({
            action: 'view_user_info',
            userId: MatrixClientPeg.get().getUserId(),
        });
        this.props.closeSettingsFn();
    }

    _onUserUnignored = async (userId) => {
        const {ignoredUserIds, waitingUnignored} = this.state;
        const currentlyIgnoredUserIds = ignoredUserIds.filter(e => !waitingUnignored.includes(e));

        const index = currentlyIgnoredUserIds.indexOf(userId);
        if (index !== -1) {
            currentlyIgnoredUserIds.splice(index, 1);
            this.setState(({waitingUnignored}) => ({waitingUnignored: [...waitingUnignored, userId]}));
            MatrixClientPeg.get().setIgnoredUsers(currentlyIgnoredUserIds);
        }
    };

    _getInvitedRooms = () => {
        return MatrixClientPeg.get().getRooms().filter((r) => {
            return r.hasMembershipState(MatrixClientPeg.get().getUserId(), "invite");
        });
    };

    _manageInvites = async (accept) => {
        this.setState({
            managingInvites: true,
        });

        // Compile array of invitation room ids
        const invitedRoomIds = this._getInvitedRooms().map((room) => {
            return room.roomId;
        });

        // Execute all acceptances/rejections sequentially
        const self = this;
        const cli = MatrixClientPeg.get();
        const action = accept ? cli.joinRoom.bind(cli) : cli.leave.bind(cli);
        for (let i = 0; i < invitedRoomIds.length; i++) {
            const roomId = invitedRoomIds[i];

            // Accept/reject invite
            await action(roomId).then(() => {
                // No error, update invited rooms button
                this.setState({invitedRoomAmt: self.state.invitedRoomAmt - 1});
            }, async (e) => {
                // Action failure
                if (e.errcode === "M_LIMIT_EXCEEDED") {
                    // Add a delay between each invite change in order to avoid rate
                    // limiting by the server.
                    await sleep(e.retry_after_ms || 2500);

                    // Redo last action
                    i--;
                } else {
                    // Print out error with joining/leaving room
                    console.warn(e);
                }
            });
        }

        this.setState({
            managingInvites: false,
        });
    };

    _onAcceptAllInvitesClicked = (ev) => {
        this._manageInvites(true);
    };

    _onRejectAllInvitesClicked = (ev) => {
        this._manageInvites(false);
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
                        <label>{_t("Session ID:")}</label>
                        <span><code>{deviceId}</code></span>
                    </li>
                    <li>
                        <label>{_t("Session key:")}</label>
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
        const {waitingUnignored, ignoredUserIds} = this.state;

        if (!ignoredUserIds || ignoredUserIds.length === 0) return null;

        const userIds = ignoredUserIds
            .map((u) => <IgnoredUser
             userId={u}
             onUnignored={this._onUserUnignored}
             key={u}
             inProgress={waitingUnignored.includes(u)}
             />);

        return (
            <div className='mx_SettingsTab_section'>
                <span className='mx_SettingsTab_subheading'>{_t('Ignored users')}</span>
                <div className='mx_SettingsTab_subsectionText'>
                    {userIds}
                </div>
            </div>
        );
    }

    _renderManageInvites() {
        if (this.state.invitedRoomAmt === 0) {
            return null;
        }

        const invitedRooms = this._getInvitedRooms();
        const InlineSpinner = sdk.getComponent('elements.InlineSpinner');
        const onClickAccept = this._onAcceptAllInvitesClicked.bind(this, invitedRooms);
        const onClickReject = this._onRejectAllInvitesClicked.bind(this, invitedRooms);
        return (
            <div className='mx_SettingsTab_section mx_SecurityUserSettingsTab_bulkOptions'>
                <span className='mx_SettingsTab_subheading'>{_t('Bulk options')}</span>
                <AccessibleButton onClick={onClickAccept} kind='primary' disabled={this.state.managingInvites}>
                    {_t("Accept all %(invitedRooms)s invites", {invitedRooms: this.state.invitedRoomAmt})}
                </AccessibleButton>
                <AccessibleButton onClick={onClickReject} kind='danger' disabled={this.state.managingInvites}>
                    {_t("Reject all %(invitedRooms)s invites", {invitedRooms: this.state.invitedRoomAmt})}
                </AccessibleButton>
                {this.state.managingInvites ? <InlineSpinner /> : <div />}
            </div>
        );
    }

    render() {
        const brand = SdkConfig.get().brand;
        const DevicesPanel = sdk.getComponent('views.settings.DevicesPanel');
        const SettingsFlag = sdk.getComponent('views.elements.SettingsFlag');
        const EventIndexPanel = sdk.getComponent('views.settings.EventIndexPanel');

        const KeyBackupPanel = sdk.getComponent('views.settings.KeyBackupPanel');
        const keyBackup = (
            <div className='mx_SettingsTab_section'>
                <span className="mx_SettingsTab_subheading">{_t("Key backup")}</span>
                <div className='mx_SettingsTab_subsectionText'>
                    <KeyBackupPanel />
                </div>
            </div>
        );

        const eventIndex = (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{_t("Message search")}</span>
                <EventIndexPanel />
            </div>
        );

        // XXX: There's no such panel in the current cross-signing designs, but
        // it's useful to have for testing the feature. If there's no interest
        // in having advanced details here once all flows are implemented, we
        // can remove this.
        const CrossSigningPanel = sdk.getComponent('views.settings.CrossSigningPanel');
        const crossSigning = (
                <div className='mx_SettingsTab_section'>
                    <span className="mx_SettingsTab_subheading">{_t("Cross-signing")}</span>
                    <div className='mx_SettingsTab_subsectionText'>
                        <CrossSigningPanel />
                    </div>
                </div>
            );

        const E2eAdvancedPanel = sdk.getComponent('views.settings.E2eAdvancedPanel');

        let warning;
        if (!privateShouldBeEncrypted()) {
            warning = <div className="mx_SecurityUserSettingsTab_warning">
                { _t("Your server admin has disabled end-to-end encryption by default " +
                    "in private rooms & Direct Messages.") }
            </div>;
        }

        return (
            <div className="mx_SettingsTab mx_SecurityUserSettingsTab">
                {warning}
                <div className="mx_SettingsTab_heading">{_t("Security & Privacy")}</div>
                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{_t("Where you’re logged in")}</span>
                    <span>
                        {_t(
                            "Manage the names of and sign out of your sessions below or " +
                            "<a>verify them in your User Profile</a>.", {},
                            {
                                a: sub => <AccessibleButton kind="link" onClick={this._onGoToUserProfileClick}>
                                    {sub}
                                </AccessibleButton>,
                            },
                        )}
                    </span>
                    <div className='mx_SettingsTab_subsectionText'>
                        {_t("A session's public name is visible to people you communicate with")}
                        <DevicesPanel />
                    </div>
                </div>
                {keyBackup}
                {eventIndex}
                {crossSigning}
                {this._renderCurrentDeviceInfo()}
                <div className='mx_SettingsTab_section'>
                    <span className="mx_SettingsTab_subheading">{_t("Analytics")}</span>
                    <div className='mx_SettingsTab_subsectionText'>
                        {_t(
                            "%(brand)s collects anonymous analytics to allow us to improve the application.",
                            { brand },
                        )}
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
                {this._renderManageInvites()}
                <E2eAdvancedPanel />
            </div>
        );
    }
}
