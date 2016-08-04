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
import q from 'q';

import sdk from '../../../index';
import MatrixClientPeg from '../../../MatrixClientPeg';
import DateUtils from '../../../DateUtils';

export default class DevicesPanelEntry extends React.Component {
    constructor(props, context) {
        super(props, context);

        this.state = {
            deleting: false,
            deleteError: undefined,
        };

        this._unmounted = false;

        this._onDeleteClick = this._onDeleteClick.bind(this);
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
            console.error("Error setting device display name", e);
            throw new Error("Failed to set display name");
        });
    }

    _onDeleteClick() {
        const device = this.props.device;
        this.setState({deleting: true});

        MatrixClientPeg.get().deleteDevice(device.device_id).done(
            () => {
                this.props.onDeleted();
                if (this._unmounted) { return; }
                this.setState({ deleting: false });
            },
            (e) => {
                console.error("Error deleting device", e);
                if (this._unmounted) { return; }
                this.setState({
                    deleting: false,
                    deleteError: "Failed to delete device",
                });
            }
        );
    }

    render() {
        const EditableTextContainer = sdk.getComponent('elements.EditableTextContainer');

        const device = this.props.device;

        if (this.state.deleting) {
            const Spinner = sdk.getComponent("elements.Spinner");

            return (
                <div className="mx_DevicesPanel_device">
                    <Spinner />
                </div>
            );
        }

        let lastSeen = "";
        if (device.last_seen_ts) {
            // todo: format the timestamp as "5 minutes ago" or whatever.
            const lastSeenDate = new Date(device.last_seen_ts);
            lastSeen = device.last_seen_ip + " @ " +
                lastSeenDate.toLocaleString();
        }

        let deleteButton;
        if (this.state.deleteError) {
            deleteButton = <div className="error">{this.state.deleteError}</div>
        } else {
            deleteButton = (
                <div className="textButton"
                  onClick={this._onDeleteClick}>
                    Delete
                </div>
            );
        }

        return (
            <div className="mx_DevicesPanel_device">
                <div className="mx_DevicesPanel_deviceName">
                    <EditableTextContainer initialValue={device.display_name}
                        onSubmit={this._onDisplayNameChanged}
                        placeholder={device.device_id}
                    />
                </div>
                <div className="mx_DevicesPanel_lastSeen">
                    {lastSeen}
                </div>
                <div className="mx_DevicesPanel_deviceButtons">
                    {deleteButton}
                </div>
            </div>
        );
    }
}

DevicesPanelEntry.propTypes = {
    device: React.PropTypes.object.isRequired,
    onDeleted: React.PropTypes.func,
};

DevicesPanelEntry.defaultProps = {
    onDeleted: function() {},
};
