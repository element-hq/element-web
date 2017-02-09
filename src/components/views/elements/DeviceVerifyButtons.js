/*
Copyright 2016 OpenMarket Ltd

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
import MatrixClientPeg from '../../../MatrixClientPeg';
import sdk from '../../../index';
import Modal from '../../../Modal';

export default React.createClass({
    displayName: 'DeviceVerifyButtons',

    propTypes: {
        userId: React.PropTypes.string.isRequired,
        device: React.PropTypes.object.isRequired,
    },

    getInitialState: function() {
        return {
            device: this.props.device
        };
    },

    componentWillMount: function() {
        const cli = MatrixClientPeg.get();
        cli.on("deviceVerificationChanged", this.onDeviceVerificationChanged);
    },

    componentWillUnmount: function() {
        const cli = MatrixClientPeg.get();
        cli.removeListener("deviceVerificationChanged", this.onDeviceVerificationChanged);
    },

    onDeviceVerificationChanged: function(userId, deviceId, deviceInfo) {
        if (userId === this.props.userId && deviceId === this.props.device.deviceId) {
            this.setState({ device: deviceInfo });
        }
    },

    onVerifyClick: function() {
        var QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        Modal.createDialog(QuestionDialog, {
            title: "Verify device",
            description: (
                <div>
                    <p>
                        To verify that this device can be trusted, please contact its
                        owner using some other means (e.g. in person or a phone call)
                        and ask them whether the key they see in their User Settings
                        for this device matches the key below:
                    </p>
                    <div className="mx_UserSettings_cryptoSection">
                        <ul>
                            <li><label>Device name:</label> <span>{ this.state.device.getDisplayName() }</span></li>
                            <li><label>Device ID:</label>   <span><code>{ this.state.device.deviceId}</code></span></li>
                            <li><label>Device key:</label>  <span><code><b>{ this.state.device.getFingerprint() }</b></code></span></li>
                        </ul>
                    </div>
                    <p>
                        If it matches, press the verify button below.
                        If it doesnt, then someone else is intercepting this device
                        and you probably want to press the blacklist button instead.
                    </p>
                    <p>
                        In future this verification process will be more sophisticated.
                    </p>
                </div>
            ),
            button: "I verify that the keys match",
            onFinished: confirm=>{
                if (confirm) {
                    MatrixClientPeg.get().setDeviceVerified(
                        this.props.userId, this.state.device.deviceId, true
                    );
                }
            },
        });
    },

    onUnverifyClick: function() {
        MatrixClientPeg.get().setDeviceVerified(
            this.props.userId, this.state.device.deviceId, false
        );
    },

    onBlacklistClick: function() {
        MatrixClientPeg.get().setDeviceBlocked(
            this.props.userId, this.state.device.deviceId, true
        );
    },

    onUnblacklistClick: function() {
        MatrixClientPeg.get().setDeviceBlocked(
            this.props.userId, this.state.device.deviceId, false
        );
    },

    render: function() {
        var blacklistButton = null, verifyButton = null;

        if (this.state.device.isBlocked()) {
            blacklistButton = (
                <button className="mx_MemberDeviceInfo_textButton mx_MemberDeviceInfo_unblacklist"
                  onClick={this.onUnblacklistClick}>
                    Unblacklist
                </button>
            );
        } else {
            blacklistButton = (
                <button className="mx_MemberDeviceInfo_textButton mx_MemberDeviceInfo_blacklist"
                  onClick={this.onBlacklistClick}>
                    Blacklist
                </button>
            );
        }

        if (this.state.device.isVerified()) {
            verifyButton = (
                <button className="mx_MemberDeviceInfo_textButton mx_MemberDeviceInfo_unverify"
                  onClick={this.onUnverifyClick}>
                    Unverify
                </button>
            );
        } else {
            verifyButton = (
                <button className="mx_MemberDeviceInfo_textButton mx_MemberDeviceInfo_verify"
                  onClick={this.onVerifyClick}>
                    Verify...
                </button>
            );
        }

        // mx_MemberDeviceInfo because the vector's CSS on EncryptedEventDialog is awful
        return (
            <div className="mx_MemberDeviceInfo mx_DeviceVerifyButtons" >
                { verifyButton }
                { blacklistButton }
            </div>
        );
    },
});
