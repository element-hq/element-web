/*
Copyright 2015, 2016 OpenMarket Ltd

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
var React = require('react');
var sdk = require('../../index');
var MatrixClientPeg = require("../../MatrixClientPeg");
var Modal = require('../../Modal');
var dis = require("../../dispatcher");
var q = require('q');
var version = require('../../../package.json').version;
var UserSettingsStore = require('../../UserSettingsStore');

module.exports = React.createClass({
    displayName: 'UserSettings',

    propTypes: {
        onClose: React.PropTypes.func
    },

    getDefaultProps: function() {
        return {
            onClose: function() {}
        };
    },

    getInitialState: function() {
        return {
            avatarUrl: null,
            threePids: [],
            clientVersion: version,
            phase: "UserSettings.LOADING", // LOADING, DISPLAY
        };
    },

    componentWillMount: function() {
        var self = this;
        this._refreshFromServer();
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        this._me = MatrixClientPeg.get().credentials.userId;
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    _refreshFromServer: function() {
        var self = this;
        q.all([
            UserSettingsStore.loadProfileInfo(), UserSettingsStore.loadThreePids()
        ]).done(function(resps) {
            self.setState({
                avatarUrl: resps[0].avatar_url,
                threepids: resps[1].threepids,
                phase: "UserSettings.DISPLAY",
            });
        }, function(error) {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Can't load user settings",
                description: error.toString()
            });
        });
    },

    onAction: function(payload) {
        if (payload.action === "notifier_enabled") {
            this.forceUpdate();
        }
    },

    onAvatarSelected: function(ev) {
        var self = this;
        var changeAvatar = this.refs.changeAvatar;
        if (!changeAvatar) {
            console.error("No ChangeAvatar found to upload image to!");
            return;
        }
        changeAvatar.onFileSelected(ev).done(function() {
            // dunno if the avatar changed, re-check it.
            self._refreshFromServer();
        }, function(err) {
            var errMsg = (typeof err === "string") ? err : (err.error || "");
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Error",
                description: "Failed to set avatar. " + errMsg
            });
        });
    },

    onLogoutClicked: function(ev) {
        var LogoutPrompt = sdk.getComponent('dialogs.LogoutPrompt');
        this.logoutModal = Modal.createDialog(
            LogoutPrompt, {onCancel: this.onLogoutPromptCancel}
        );
    },

    onPasswordChangeError: function(err) {
        var errMsg = err.error || "";
        if (err.httpStatus === 403) {
            errMsg = "Failed to change password. Is your password correct?";
        }
        else if (err.httpStatus) {
            errMsg += ` (HTTP status ${err.httpStatus})`;
        }
        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        Modal.createDialog(ErrorDialog, {
            title: "Error",
            description: errMsg
        });
    },

    onPasswordChanged: function() {
        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        Modal.createDialog(ErrorDialog, {
            title: "Success",
            description: `Your password was successfully changed. You will not
                          receive push notifications on other devices until you
                          log back in to them.`
        });
    },

    onLogoutPromptCancel: function() {
        this.logoutModal.closeDialog();
    },

    onEnableNotificationsChange: function(event) {
        UserSettingsStore.setEnableNotifications(event.target.checked);
    },

    render: function() {
        switch (this.state.phase) {
            case "UserSettings.LOADING":
                var Loader = sdk.getComponent("elements.Spinner");
                return (
                    <Loader />
                );
            case "UserSettings.DISPLAY":
                break; // quit the switch to return the common state
            default:
                throw new Error("Unknown state.phase => " + this.state.phase);
        }
        // can only get here if phase is UserSettings.DISPLAY
        var RoomHeader = sdk.getComponent('rooms.RoomHeader');
        var ChangeDisplayName = sdk.getComponent("views.settings.ChangeDisplayName");
        var ChangePassword = sdk.getComponent("views.settings.ChangePassword");
        var ChangeAvatar = sdk.getComponent('settings.ChangeAvatar');
        var avatarUrl = (
            this.state.avatarUrl ? MatrixClientPeg.get().mxcUrlToHttp(this.state.avatarUrl) : null
        );

        return (
            <div className="mx_UserSettings">
                <RoomHeader simpleHeader="Settings" />

                <h2>Profile</h2>

                <div className="mx_UserSettings_section">
                    <div className="mx_UserSettings_profileTable">
                        <div className="mx_UserSettings_profileTableRow">
                            <div className="mx_UserSettings_profileLabelCell">
                                <label htmlFor="displayName">Display name</label>
                            </div>
                            <div className="mx_UserSettings_profileInputCell">
                                <ChangeDisplayName />
                            </div>
                        </div>

                        {this.state.threepids.map(function(val, pidIndex) {
                            var id = "email-" + val.address;
                            return (
                                <div className="mx_UserSettings_profileTableRow" key={pidIndex}>
                                    <div className="mx_UserSettings_profileLabelCell">
                                        <label htmlFor={id}>Email</label>
                                    </div>
                                    <div className="mx_UserSettings_profileInputCell">
                                        <input key={val.address} id={id} value={val.address} disabled />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mx_UserSettings_avatarPicker">
                        <ChangeAvatar ref="changeAvatar" initialAvatarUrl={avatarUrl}
                            showUploadSection={false} className="mx_UserSettings_avatarPicker_img"/>
                        <div className="mx_UserSettings_avatarPicker_edit">
                            <label htmlFor="avatarInput">
                                <img src="img/upload.svg"
                                    alt="Upload avatar" title="Upload avatar"
                                    width="19" height="24" />
                            </label>
                            <input id="avatarInput" type="file" onChange={this.onAvatarSelected}/>
                        </div>
                    </div>
                </div>

                <h2>Account</h2>

                <div className="mx_UserSettings_section">
                    <ChangePassword
                        className="mx_UserSettings_accountTable"
                        rowClassName="mx_UserSettings_profileTableRow"
                        rowLabelClassName="mx_UserSettings_profileLabelCell"
                        rowInputClassName="mx_UserSettings_profileInputCell"
                        buttonClassName="mx_UserSettings_button"
                        onError={this.onPasswordChangeError}
                        onFinished={this.onPasswordChanged} />                   
                </div>

                <div className="mx_UserSettings_logout">
                    <div className="mx_UserSettings_button" onClick={this.onLogoutClicked}>
                        Log out
                    </div>
                </div>

                <h2>Notifications</h2>

                <div className="mx_UserSettings_section">
                    <div className="mx_UserSettings_notifTable">
                        <div className="mx_UserSettings_notifTableRow">
                            <div className="mx_UserSettings_notifInputCell">
                                <input id="enableNotifications"
                                    ref="enableNotifications"
                                    type="checkbox"
                                    checked={ UserSettingsStore.getEnableNotifications() }
                                    onChange={ this.onEnableNotificationsChange } />
                            </div>
                            <div className="mx_UserSettings_notifLabelCell">
                                <label htmlFor="enableNotifications">
                                    Enable desktop notifications
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <h2>Advanced</h2>

                <div className="mx_UserSettings_section">
                    <div className="mx_UserSettings_advanced">
                        Logged in as {this._me}
                    </div>
                    <div className="mx_UserSettings_advanced">
                        Version {this.state.clientVersion}
                    </div>
                </div>
            </div>
        );
    }
});
