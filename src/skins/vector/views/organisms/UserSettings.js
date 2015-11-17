/*
Copyright 2015 OpenMarket Ltd
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

'use strict';

var React = require('react');
var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher')
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var q = require('q');

var version = require('../../../../../package.json').version;

var Modal = require('matrix-react-sdk/lib/Modal');
var UserSettingsStore = require('matrix-react-sdk/lib/UserSettingsStore');

module.exports = React.createClass({
    displayName: 'UserSettings',

    Phases: {
        Loading: "loading",
        Saving: "saving",
        Display: "display",
    },

    getInitialState: function() {
        return {
            avatarUrl: null,
            displayName: null,
            threePids: [],
            clientVersion: version,
            phase: this.Phases.Loading,
        };
    },

    componentWillMount: function() {
        var self = this;

        var profilePromise = UserSettingsStore.loadProfileInfo();
        var threepidPromise = UserSettingsStore.loadThreePids();

        q.all([profilePromise, threepidPromise]).then(
            function(resps) {
                self.setState({
                    avatarUrl: resps[0].avatar_url,
                    displayName: resps[0].displayname,
                    threepids: resps[1].threepids,
                    phase: self.Phases.Display,
                });

                // keep a copy of the original state in order to track changes
                self.setState({
                    originalState: self.state
                });
            },
            function(error) {
                var ErrorDialog = sdk.getComponent("organisms.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Can't load user settings",
                    description: error.toString()
                });
            }
        );
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    onSaveClicked: function(ev) {
        var self = this;
        var savePromises = [];

        // XXX: this is managed in ChangeAvatar.js, although could be moved out here in order
        // to allow for the change to be staged alongside the rest of the form.
        //
        // if (this.state.originalState.avatarUrl !== this.state.avatarUrl) {
        //     savePromises.push( UserSettingsStore.saveAvatarUrl(this.state.avatarUrl) );
        // }

        if (this.state.originalState.displayName !== this.state.displayName) {
            savePromises.push( UserSettingsStore.saveDisplayName(this.state.displayName) );
        }

        if (this.state.originalState.threepids.length !== this.state.threepids.length ||
            this.state.originalState.threepids.every(function(element, index) {
                    return element === this.state.threepids[index];
            }))
        {
            savePromises.push( UserSettingsStore.saveThreePids(this.state.threepids) );
        }

        // TODO: do the password check

        self.setState({
            phase: self.Phases.Saving,
        });

        q.all(savePromises).then(
            function(resps) {
                self.setState({
                    phase: self.Phases.Display,
                });
                self.onClose();
            },
            function(error) {
                self.setState({
                    phase: self.Phases.Display,
                });
                var ErrorDialog = sdk.getComponent("organisms.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Can't save user settings",
                    description: error.toString()
                });
            }
        );        
    },

    onClose: function(ev) {
        // XXX: use browser history instead to find the previous room?
        if (this.props.roomId) {
            dis.dispatch({
                action: 'view_room',
                room_id: this.props.roomId,
            });
        }
        else {
            dis.dispatch({
                action: 'view_indexed_room',
                roomIndex: 0,
            });
        }
    },

    onAction: function(payload) {
        if (payload.action === "notifier_enabled") {
            this.setState({
                enableNotifications : UserSettingsStore.getEnableNotifications()
            });
        }
    },    

    editAvatar: function() {
        var url = MatrixClientPeg.get().mxcUrlToHttp(this.state.avatarUrl);
        var ChangeAvatar = sdk.getComponent('molecules.ChangeAvatar');
        var avatarDialog = (
            <div>
                <ChangeAvatar initialAvatarUrl={url} />
                <div className="mx_Dialog_buttons">
                    <button onClick={this.onAvatarDialogCancel}>Cancel</button>
                </div>
            </div>
        );
        this.avatarDialog = Modal.createDialogWithElement(avatarDialog);
    },

    onAvatarDialogCancel: function() {
        this.avatarDialog.close();
    },

    onLogoutClicked: function(event) {
        var LogoutPrompt = sdk.getComponent('organisms.LogoutPrompt');
        this.logoutModal = Modal.createDialog(LogoutPrompt, {onCancel: this.onLogoutPromptCancel});
    },

    onLogoutPromptCancel: function() {
        this.logoutModal.closeDialog();
    },

    onDisplayNameChange: function(event) {
        this.setState({ displayName: event.target.value });
    },

    onEnableNotificationsChange: function(event) {
        // don't bother waiting for Save to be clicked, as that'd be silly
        UserSettingsStore.setEnableNotifications( this.refs.enableNotifications.value );

        this.setState({
            enableNotifications : UserSettingsStore.getEnableNotifications()
        });
    },

    render: function() {
        var Loader = sdk.getComponent("atoms.Spinner");
        var saving;
        switch (this.state.phase) {
            case this.Phases.Loading:
                return <Loader />
            case this.Phases.Saving:
                saving = <Loader />
            case this.Phases.Display:
                var RoomHeader = sdk.getComponent('molecules.RoomHeader');
                return (
                    <div className="mx_UserSettings">
                        <RoomHeader simpleHeader="Settings" onCancelClick={ this.onClose } />

                        <h2>Profile</h2>

                        <div className="mx_UserSettings_section">
                            <div className="mx_UserSettings_profileTable">
                                <div className="mx_UserSettings_profileTableRow">
                                    <div className="mx_UserSettings_profileLabelCell">
                                        <label htmlFor="displayName">Display name</label>
                                    </div>
                                    <div className="mx_UserSettings_profileInputCell">
                                        <input id="displayName" ref="displayName" value={ this.state.displayName } onChange={ this.onDisplayNameChange } />
                                    </div>
                                </div>

                                {this.state.threepids.map(function(val) {
                                    var id = "email-" + val.address;
                                    return (
                                        <div className="mx_UserSettings_profileTableRow">
                                            <div className="mx_UserSettings_profileLabelCell">
                                                <label htmlFor={ id }>Email</label>
                                            </div>
                                            <div className="mx_UserSettings_profileInputCell">
                                                <input key={val.address} id={ id } value={ val.address } disabled />
                                            </div>
                                        </div>
                                    );
                                })}

                                <div className="mx_UserSettings_profileTableRow">
                                    <div className="mx_UserSettings_profileLabelCell">
                                        <label htmlFor="password1">New password</label>
                                    </div>
                                    <div className="mx_UserSettings_profileInputCell">
                                        <input id="password1" ref="password1" value={ this.state.password1 } />
                                    </div>
                                </div>
                                <div className="mx_UserSettings_profileTableRow">
                                    <div className="mx_UserSettings_profileLabelCell">
                                        <label htmlFor="password2">Confirm new password</label>
                                    </div>
                                    <div className="mx_UserSettings_profileInputCell">
                                        <input id="password2" ref="password2" value={ this.state.password2 } />
                                    </div>
                                </div>

                            </div>                        

                            <div className="mx_UserSettings_avatarPicker">
                                <div className="mx_UserSettings_avatarPicker_edit" onClick={this.editAvatar}></div>
                            </div>
                        </div>

                        <div className="mx_UserSettings_logout">
                            <div className="mx_UserSettings_button" onClick={this.onLogoutClicked}>Log out</div>
                        </div>

                        <h2>Notifications</h2>

                        <div className="mx_UserSettings_section">
                            <div className="mx_UserSettings_notifTable">
                                <div className="mx_UserSettings_notifTableRow">
                                    <div className="mx_UserSettings_notifInputCell">
                                        <input id="enableNotifications" ref="enableNotifications" type="checkbox" checked={ this.state.enableNotifications } onChange={ this.onEnableNotificationsChange } />
                                    </div>
                                    <div className="mx_UserSettings_notifLabelCell">
                                        <label htmlFor="enableNotifications">Enable desktop notifications</label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <h2>Advanced</h2>

                        <div className="mx_UserSettings_section">
                            <div className="mx_UserSettings_advanced">
                                Version {this.state.clientVersion}
                            </div>
                        </div>

                        <div className="mx_UserSettings_save">
                            <div className="mx_UserSettings_spinner">{ saving }</div>
                            <div className="mx_UserSettings_button" onClick={this.onSaveClicked}>Save and close</div>
                        </div>
                    </div>
                );
        }
    }
});
