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
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import * as sdk from '../../../index';
import Modal from '../../../Modal';
import { _t } from '../../../languageHandler';

// XXX: This component is *not* cross-signing aware. Once everything is
// cross-signing, this component should just go away.
export default createReactClass({
    displayName: 'DeviceVerifyButtons',

    propTypes: {
        userId: PropTypes.string.isRequired,
        device: PropTypes.object.isRequired,
    },

    getInitialState: function() {
        return {
            device: this.props.device,
        };
    },

    componentWillMount: function() {
        const cli = MatrixClientPeg.get();
        cli.on("deviceVerificationChanged", this.onDeviceVerificationChanged);
    },

    componentWillUnmount: function() {
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener("deviceVerificationChanged", this.onDeviceVerificationChanged);
        }
    },

    onDeviceVerificationChanged: function(userId, deviceId, deviceInfo) {
        if (userId === this.props.userId && deviceId === this.props.device.deviceId) {
            this.setState({ device: deviceInfo });
        }
    },

    onVerifyClick: function() {
        const DeviceVerifyDialog = sdk.getComponent('views.dialogs.DeviceVerifyDialog');
        Modal.createTrackedDialog('Device Verify Dialog', '', DeviceVerifyDialog, {
            userId: this.props.userId,
            device: this.state.device,
        }, null, /* priority = */ false, /* static = */ true);
    },

    onUnverifyClick: function() {
        MatrixClientPeg.get().setDeviceVerified(
            this.props.userId, this.state.device.deviceId, false,
        );
    },

    onBlacklistClick: function() {
        MatrixClientPeg.get().setDeviceBlocked(
            this.props.userId, this.state.device.deviceId, true,
        );
    },

    onUnblacklistClick: function() {
        MatrixClientPeg.get().setDeviceBlocked(
            this.props.userId, this.state.device.deviceId, false,
        );
    },

    render: function() {
        let blacklistButton = null; let verifyButton = null;

        if (this.state.device.isBlocked()) {
            blacklistButton = (
                <button className="mx_MemberDeviceInfo_textButton mx_MemberDeviceInfo_unblacklist"
                  onClick={this.onUnblacklistClick}>
                    { _t("Unblacklist") }
                </button>
            );
        } else {
            blacklistButton = (
                <button className="mx_MemberDeviceInfo_textButton mx_MemberDeviceInfo_blacklist"
                  onClick={this.onBlacklistClick}>
                    { _t("Blacklist") }
                </button>
            );
        }

        if (this.state.device.isVerified()) {
            verifyButton = (
                <button className="mx_MemberDeviceInfo_textButton mx_MemberDeviceInfo_unverify"
                  onClick={this.onUnverifyClick}>
                    { _t("Unverify") }
                </button>
            );
        } else {
            verifyButton = (
                <button className="mx_MemberDeviceInfo_textButton mx_MemberDeviceInfo_verify"
                  onClick={this.onVerifyClick}>
                    { _t("Verify...") }
                </button>
            );
        }

        return (
            <div className="mx_DeviceVerifyButtons" >
                { verifyButton }
                { blacklistButton }
            </div>
        );
    },
});
