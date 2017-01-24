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
import classNames from 'classnames';

import sdk from '../../../index';
import MatrixClientPeg from '../../../MatrixClientPeg';


export default class DevicesPanel extends React.Component {
    constructor(props, context) {
        super(props, context);

        this.state = {
            devices: undefined,
            deviceLoadError: undefined,
        };

        this._unmounted = false;

        this._renderDevice = this._renderDevice.bind(this);
    }

    componentDidMount() {
        this._loadDevices();
    }

    componentWillUnmount() {
        this._unmounted = true;
    }

    _loadDevices() {
        MatrixClientPeg.get().getDevices().done(
            (resp) => {
                if (this._unmounted) { return; }
                this.setState({devices: resp.devices || []});
            },
            (error) => {
                if (this._unmounted) { return; }
                var errtxt;
                if (error.httpStatus == 404) {
                    // 404 probably means the HS doesn't yet support the API.
                    errtxt = "Your home server does not support device management.";
                } else {
                    console.error("Error loading devices:", error);
                    errtxt = "Unable to load device list.";
                }
                this.setState({deviceLoadError: errtxt});
            }
        );
    }


    /**
     * compare two devices, sorting from most-recently-seen to least-recently-seen
     * (and then, for stability, by device id)
     */
    _deviceCompare(a, b) {
        // return < 0 if a comes before b, > 0 if a comes after b.
        const lastSeenDelta =
              (b.last_seen_ts || 0) - (a.last_seen_ts || 0);

        if (lastSeenDelta !== 0) { return lastSeenDelta; }

        const idA = a.device_id;
        const idB = b.device_id;
        return (idA < idB) ? -1 : (idA > idB) ? 1 : 0;
    }

    _onDeviceDeleted(device) {
        if (this._unmounted) { return; }

        // delete the removed device from our list.
        const removed_id = device.device_id;
        this.setState((state, props) => {
            const newDevices = state.devices.filter(
                d => { return d.device_id != removed_id; }
            );
            return { devices: newDevices };
        });
    }

    _renderDevice(device) {
        var DevicesPanelEntry = sdk.getComponent('settings.DevicesPanelEntry');
        return (
            <DevicesPanelEntry key={device.device_id} device={device}
               onDeleted={()=>{this._onDeviceDeleted(device);}} />
        );
    }

    render() {
        const Spinner = sdk.getComponent("elements.Spinner");

        if (this.state.deviceLoadError !== undefined) {
            const classes = classNames(this.props.className, "error");
            return (
                <div className={classes}>
                    {this.state.deviceLoadError}
                </div>
            );
        }

        const devices = this.state.devices;
        if (devices === undefined) {
            // still loading
            const classes = this.props.className;
            return <Spinner className={classes}/>;
        }

        devices.sort(this._deviceCompare);

        const classes = classNames(this.props.className, "mx_DevicesPanel");
        return (
            <div className={classes}>
                <div className="mx_DevicesPanel_header">
                    <div className="mx_DevicesPanel_deviceId">ID</div>
                    <div className="mx_DevicesPanel_deviceName">Name</div>
                    <div className="mx_DevicesPanel_deviceLastSeen">Last seen</div>
                    <div className="mx_DevicesPanel_deviceButtons"></div>
                </div>
                {devices.map(this._renderDevice)}
            </div>
        );
    }
}

DevicesPanel.displayName = 'MemberDeviceInfo';
DevicesPanel.propTypes = {
    className: React.PropTypes.string,
};
