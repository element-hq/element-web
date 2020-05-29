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
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import classNames from 'classnames';

export default class MemberDeviceInfo extends React.Component {
    render() {
        const DeviceVerifyButtons = sdk.getComponent('elements.DeviceVerifyButtons');
        // XXX: These checks are not cross-signing aware but this component is only used
        // from the old, pre-cross-signing memberinfopanel
        const iconClasses = classNames({
            mx_MemberDeviceInfo_icon: true,
            mx_MemberDeviceInfo_icon_blacklisted: this.props.device.isBlocked(),
            mx_MemberDeviceInfo_icon_verified: this.props.device.isVerified(),
            mx_MemberDeviceInfo_icon_unverified: this.props.device.isUnverified(),
        });
        const indicator = (<div className={iconClasses} />);
        const deviceName = (this.props.device.ambiguous || this.props.showDeviceId) ?
            (this.props.device.getDisplayName() ? this.props.device.getDisplayName() : "") + " (" + this.props.device.deviceId + ")" :
            this.props.device.getDisplayName();

        // add the deviceId as a titletext to help with debugging
        return (
            <div className="mx_MemberDeviceInfo"
                    title={_t("device id: ") + this.props.device.deviceId} >
                { indicator }
                <div className="mx_MemberDeviceInfo_deviceInfo">
                    <div className="mx_MemberDeviceInfo_deviceId">
                        { deviceName }
                    </div>
                </div>
                <DeviceVerifyButtons userId={this.props.userId} device={this.props.device} />
            </div>
        );
    }
}

MemberDeviceInfo.displayName = 'MemberDeviceInfo';
MemberDeviceInfo.propTypes = {
    userId: PropTypes.string.isRequired,
    device: PropTypes.object.isRequired,
};
