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
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import {formatDate} from '../../../DateUtils';
import StyledCheckbox from '../elements/StyledCheckbox';

export default class DevicesPanelEntry extends React.Component {
    constructor(props) {
        super(props);

        this._unmounted = false;
        this.onDeviceToggled = this.onDeviceToggled.bind(this);
        this._onDisplayNameChanged = this._onDisplayNameChanged.bind(this);
    }

    componentWillUnmount() {
        this._unmounted = true;
    }

    _onDisplayNameChanged(value) {
        const device = this.props.device;
        return MatrixClientPeg.get().setDeviceDetails(device.device_id, {
            display_name: value,
        }).catch((e) => {
            console.error("Error setting session display name", e);
            throw new Error(_t("Failed to set display name"));
        });
    }

    onDeviceToggled() {
        this.props.onDeviceToggled(this.props.device);
    }

    render() {
        const EditableTextContainer = sdk.getComponent('elements.EditableTextContainer');

        const device = this.props.device;

        let lastSeen = "";
        if (device.last_seen_ts) {
            const lastSeenDate = formatDate(new Date(device.last_seen_ts));
            lastSeen = device.last_seen_ip + " @ " +
                lastSeenDate.toLocaleString();
        }

        let myDeviceClass = '';
        if (device.device_id === MatrixClientPeg.get().getDeviceId()) {
            myDeviceClass = " mx_DevicesPanel_myDevice";
        }

        return (
            <div className={"mx_DevicesPanel_device" + myDeviceClass}>
                <div className="mx_DevicesPanel_deviceId">
                    { device.device_id }
                </div>
                <div className="mx_DevicesPanel_deviceName">
                    <EditableTextContainer initialValue={device.display_name}
                        onSubmit={this._onDisplayNameChanged}
                        placeholder={device.device_id}
                    />
                </div>
                <div className="mx_DevicesPanel_lastSeen">
                    { lastSeen }
                </div>
                <div className="mx_DevicesPanel_deviceButtons">
                    <StyledCheckbox onChange={this.onDeviceToggled} checked={this.props.selected} />
                </div>
            </div>
        );
    }
}

DevicesPanelEntry.propTypes = {
    device: PropTypes.object.isRequired,
    onDeviceToggled: PropTypes.func,
};

DevicesPanelEntry.defaultProps = {
    onDeviceToggled: function() {},
};
