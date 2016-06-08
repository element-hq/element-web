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
        MatrixClientPeg.get().setDeviceVerified(this.props.userId,
                                                this.props.device.id);
    },

    render: function() {
        var indicator = null, button = null;
        if (this.props.device.verified) {
            indicator = (
                <div className="mx_MemberDeviceInfo_verified">&#x2714;</div>
            );
        } else {
            button = (
                <div className="mx_MemberDeviceInfo_textButton"
                  onClick={this.onVerifyClick}>
                    Verify
                </div>
            );
        }
        return (
            <div className="mx_MemberDeviceInfo">
                <div className="mx_MemberDeviceInfo_deviceId">{this.props.device.id}</div>
                <div className="mx_MemberDeviceInfo_deviceKey">{this.props.device.key}</div>
                {indicator}
                {button}
            </div>
        );
    },
});
