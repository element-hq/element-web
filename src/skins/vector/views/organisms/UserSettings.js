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
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');

var UserSettingsController = require('matrix-react-sdk/lib/controllers/organisms/UserSettings')

var Loader = require("react-loader");

var Modal = require('matrix-react-sdk/lib/Modal');

module.exports = React.createClass({
    displayName: 'UserSettings',
    mixins: [UserSettingsController],

    editAvatar: function() {
        var url = MatrixClientPeg.get().mxcUrlToHttp(this.state.avatarUrl);
        var ChangeAvatar = sdk.getComponent('molecules.ChangeAvatar');
        Modal.createDialog(ChangeAvatar, {initialAvatarUrl: url});
    },

    addEmail: function() {

    },

    editDisplayName: function() {
        this.refs.displayname.edit();
    },

    changePassword: function() {
        Modal.createDialog(ChangePassword);
    },

    onLogoutClicked: function(ev) {
        var LogoutPrompt = sdk.getComponent('organisms.LogoutPrompt');
        this.logoutModal = Modal.createDialog(LogoutPrompt, {onCancel: this.onLogoutPromptCancel});
    },

    onLogoutPromptCancel: function() {
        this.logoutModal.closeDialog();
    },

    render: function() {
        switch (this.state.phase) {
            case this.Phases.Loading:
                return <Loader />
            case this.Phases.Display:
                var EditableText = sdk.getComponent('atoms/EditableText');
                var EnableNotificationsButton = sdk.getComponent('atoms/EnableNotificationsButton');
                var ChangePassword = sdk.getComponent('molecules/ChangePassword');
                return (
                    <div className="mx_UserSettings">
                        <div className="mx_UserSettings_User">
                            <h1>User Settings</h1>
                            <hr/>
                            <div className="mx_UserSettings_User_Inner">
                                <div className="mx_UserSettings_Avatar">
                                    <div className="mx_UserSettings_Avatar_Text">Profile Photo</div>
                                    <div className="mx_UserSettings_Avatar_Edit" onClick={this.editAvatar}>Edit</div>
                                </div>

                                <div className="mx_UserSettings_DisplayName">
                                    <EditableText ref="displayname" initialValue={this.state.displayName} label="Click to set display name." onValueChanged={this.changeDisplayname}/>
                                    <div className="mx_UserSettings_DisplayName_Edit" onClick={this.editDisplayName}>Edit</div>
                                </div>

                                <div className="mx_UserSettings_3pids">
                                    {this.state.threepids.map(function(val) {
                                        return <div>{val.address}</div>;
                                    })}
                                </div>

                                <div className="mx_UserSettings_Add3pid" onClick={this.addEmail}>Add email</div>
                            </div>
                        </div>

                        <div className="mx_UserSettings_Global">
                            <h1>Global Settings</h1>
                            <hr/>
                            <div className="mx_UserSettings_Global_Inner">
                                <div className="mx_UserSettings_ChangePassword" onClick={this.changePassword}>
                                    Change Password
                                </div>
                                <div className="mx_UserSettings_ClientVersion">
                                    Version {this.state.clientVersion}
                                </div>
                                <div className="mx_UserSettings_EnableNotifications">
                                    <EnableNotificationsButton />
                                </div>
                                <div className="mx_UserSettings_Logout">
                                    <button onClick={this.onLogoutClicked}>Sign Out</button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
        }
    }
});
