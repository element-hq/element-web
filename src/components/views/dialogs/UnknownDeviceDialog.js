/*
Copyright 2017 Vector Creations Ltd

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
import dis from '../../../dispatcher';
import MatrixClientPeg from '../../../MatrixClientPeg';
import GeminiScrollbar from 'react-gemini-scrollbar';
import Resend from '../../../Resend';

function DeviceListEntry(props) {
    const {userId, device} = props;

    const DeviceVerifyButtons = sdk.getComponent('elements.DeviceVerifyButtons');

    return (
        <li>
            <DeviceVerifyButtons device={ device } userId={ userId } />
            { device.deviceId }
            <br/>
            { device.getDisplayName() }
        </li>
    );
}

DeviceListEntry.propTypes = {
    userId: React.PropTypes.string.isRequired,

    // deviceinfo
    device: React.PropTypes.object.isRequired,
};


function UserUnknownDeviceList(props) {
    const {userId, userDevices} = props;

    const deviceListEntries = Object.keys(userDevices).map((deviceId) =>
       <DeviceListEntry key={ deviceId } userId={ userId }
           device={ userDevices[deviceId] } />,
    );

    return (
        <ul className="mx_UnknownDeviceDialog_deviceList">
            {deviceListEntries}
        </ul>
    );
}

UserUnknownDeviceList.propTypes = {
    userId: React.PropTypes.string.isRequired,

    // map from deviceid -> deviceinfo
    userDevices: React.PropTypes.object.isRequired,
};


function UnknownDeviceList(props) {
    const {devices} = props;

    const userListEntries = Object.keys(devices).map((userId) =>
        <li key={ userId }>
            <p>{ userId }:</p>
            <UserUnknownDeviceList userId={ userId } userDevices={ devices[userId] } />
        </li>,
    );

    return <ul>{userListEntries}</ul>;
}

UnknownDeviceList.propTypes = {
    // map from userid -> deviceid -> deviceinfo
    devices: React.PropTypes.object.isRequired,
};


export default React.createClass({
    displayName: 'UnknownDeviceDialog',

    propTypes: {
        room: React.PropTypes.object.isRequired,

        // map from userid -> deviceid -> deviceinfo
        devices: React.PropTypes.object.isRequired,
        onFinished: React.PropTypes.func.isRequired,
    },

    componentDidMount: function() {
        // Given we've now shown the user the unknown device, it is no longer
        // unknown to them. Therefore mark it as 'known'.
        Object.keys(this.props.devices).forEach((userId) => {
            Object.keys(this.props.devices[userId]).map((deviceId) => {
                MatrixClientPeg.get().setDeviceKnown(userId, deviceId, true);
            });
        });

        // XXX: temporary logging to try to diagnose
        // https://github.com/vector-im/riot-web/issues/3148
        console.log('Opening UnknownDeviceDialog');
    },

    render: function() {
        const client = MatrixClientPeg.get();
        const blacklistUnverified = client.getGlobalBlacklistUnverifiedDevices() ||
              this.props.room.getBlacklistUnverifiedDevices();

        let warning;
        if (blacklistUnverified) {
            warning = (
                <h4>
                    You are currently blacklisting unverified devices; to send
                    messages to these devices you must verify them.
                </h4>
            );
        } else {
            warning = (
                <div>
                    <p>
                        We recommend you go through the verification process
                        for each device to confirm they belong to their legitimate owner,
                        but you can resend the message without verifying if you prefer.
                    </p>
                </div>
            );
        }

        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        return (
            <BaseDialog className='mx_UnknownDeviceDialog'
                onFinished={() => {
                            // XXX: temporary logging to try to diagnose
                            // https://github.com/vector-im/riot-web/issues/3148
                            console.log("UnknownDeviceDialog closed by escape");
                            this.props.onFinished();
                }}
                title='Room contains unknown devices'
            >
                <GeminiScrollbar autoshow={false} className="mx_Dialog_content">
                    <h4>
                        "{this.props.room.name}" contains devices that you haven't seen before.
                    </h4>
                    { warning }
                    Unknown devices:

                    <UnknownDeviceList devices={this.props.devices} />
                </GeminiScrollbar>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" autoFocus={ true }
                            onClick={() => {
                                this.props.onFinished();
                                Resend.resendUnsentEvents(this.props.room);
                            }}>
                        Send anyway
                    </button>
                    <button className="mx_Dialog_primary" autoFocus={ true }
                            onClick={() => {
                                // XXX: temporary logging to try to diagnose
                                // https://github.com/vector-im/riot-web/issues/3148
                                console.log("UnknownDeviceDialog closed by OK");
                                this.props.onFinished();
                            }}>
                        OK
                    </button>
                </div>
            </BaseDialog>
        );
        // XXX: do we want to give the user the option to enable blacklistUnverifiedDevices for this room (or globally) at this point?
        // It feels like confused users will likely turn it on and then disappear in a cloud of UISIs...
    },
});
