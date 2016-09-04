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

var React = require('react');
var MatrixClientPeg = require("../../../MatrixClientPeg");

module.exports = React.createClass({
    displayName: 'MemberDeviceInfo',
    propTypes: {
        userId: React.PropTypes.string.isRequired,
        device: React.PropTypes.object.isRequired,
    },

    onVerifyClick: function() {
        MatrixClientPeg.get().setDeviceVerified(
            this.props.userId, this.props.device.deviceId, true
        );
    },

    onUnverifyClick: function() {
        MatrixClientPeg.get().setDeviceVerified(
            this.props.userId, this.props.device.deviceId, false
        );
    },

    onBlockClick: function() {
        MatrixClientPeg.get().setDeviceBlocked(
            this.props.userId, this.props.device.deviceId, true
        );
    },

    onUnblockClick: function() {
        MatrixClientPeg.get().setDeviceBlocked(
            this.props.userId, this.props.device.deviceId, false
        );
    },

    render: function() {
        var indicator = null, blockButton = null, verifyButton = null;
        if (this.props.device.isBlocked()) {
            blockButton = (
                <div className="mx_MemberDeviceInfo_textButton mx_MemberDeviceInfo_unblock"
                  onClick={this.onUnblockClick}>
                    Unblock
                </div>
            );
        } else {
            blockButton = (
                <div className="mx_MemberDeviceInfo_textButton mx_MemberDeviceInfo_block"
                  onClick={this.onBlockClick}>
                    Block
                </div>
            );
        }

        if (this.props.device.isVerified()) {
            verifyButton = (
                <div className="mx_MemberDeviceInfo_textButton mx_MemberDeviceInfo_unverify"
                  onClick={this.onUnverifyClick}>
                    Unverify
                </div>
            );
        } else {
            verifyButton = (
                <div className="mx_MemberDeviceInfo_textButton mx_MemberDeviceInfo_verify"
                  onClick={this.onVerifyClick}>
                    Verify
                </div>
            );
        }

        if (this.props.device.isBlocked()) {
            indicator = (
                <div className="mx_MemberDeviceInfo_blocked">Blocked</div>
            );
        } else if (this.props.device.isVerified()) {
            indicator = (
                    <div className="mx_MemberDeviceInfo_verified">Verified</div>
            );

        } else {
            indicator = (
                <div className="mx_MemberDeviceInfo_unverified">Unverified</div>
            );
        }

        var deviceName = this.props.device.display_name || this.props.device.deviceId;

        return (
            <div className="mx_MemberDeviceInfo">
                <div className="mx_MemberDeviceInfo_deviceId">{deviceName}</div>
                {indicator}
                {verifyButton}
                {blockButton}
            </div>
        );
    },
});
