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
import sdk from '../../../index';

export default class MemberDeviceInfo extends React.Component {
    render() {
        var indicator = null;
        var DeviceVerifyButtons = sdk.getComponent('elements.DeviceVerifyButtons');

        if (this.props.device.isBlocked()) {
            indicator = (
                    <div className="mx_MemberDeviceInfo_blacklisted">
                    <img src="img/e2e-blocked.svg" width="12" height="12" style={{ marginLeft: "-1px" }} alt="Blacklisted"/>
                    </div>
            );
        } else if (this.props.device.isVerified()) {
            indicator = (
                    <div className="mx_MemberDeviceInfo_verified">
                    <img src="img/e2e-verified.svg" width="10" height="12" alt="Verified"/>
                    </div>
            );
        } else {
            indicator = (
                    <div className="mx_MemberDeviceInfo_unverified">
                    <img src="img/e2e-warning.svg" width="15" height="12" style={{ marginLeft: "-2px" }} alt="Unverified"/>
                    </div>
            );
        }

        var deviceName = this.props.device.ambiguous ?
            (this.props.device.getDisplayName() ? this.props.device.getDisplayName() : "") + " (" + this.props.device.deviceId + ")" :
            this.props.device.getDisplayName();

        // add the deviceId as a titletext to help with debugging
        return (
            <div className="mx_MemberDeviceInfo"
                    title={"device id: " + this.props.device.deviceId} >
                <div className="mx_MemberDeviceInfo_deviceInfo">
                    <div className="mx_MemberDeviceInfo_deviceId">
                        {deviceName}
                        {indicator}
                    </div>
                </div>
                <DeviceVerifyButtons userId={this.props.userId} device={this.props.device} />
            </div>
        );
    }
}

MemberDeviceInfo.displayName = 'MemberDeviceInfo';
MemberDeviceInfo.propTypes = {
    userId: React.PropTypes.string.isRequired,
    device: React.PropTypes.object.isRequired,
};
