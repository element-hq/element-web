/*
Copyright 2015, 2016 OpenMarket Ltd

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
import MatrixClientPeg from '../../../MatrixClientPeg';
import GeminiScrollbar from 'react-gemini-scrollbar';

function UserUnknownDeviceList(props) {
    const {userDevices} = props;

    const deviceListEntries = Object.keys(userDevices).map((deviceId) =>
        <li key={ deviceId }>
            { deviceId } ( { userDevices[deviceId].getDisplayName() } )
        </li>,
    );

    return <ul>{deviceListEntries}</ul>;
}

UserUnknownDeviceList.propTypes = {
    // map from deviceid -> deviceinfo
    userDevices: React.PropTypes.object.isRequired,
};


function UnknownDeviceList(props) {
    const {devices} = props;

    const userListEntries = Object.keys(devices).map((userId) =>
        <li key={ userId }>
            <p>{ userId }:</p>
            <UserUnknownDeviceList userDevices={devices[userId]} />
        </li>,
    );

    return <ul>{userListEntries}</ul>;
}

UnknownDeviceList.propTypes = {
    // map from userid -> deviceid -> deviceinfo
    devices: React.PropTypes.object.isRequired,
};


export default React.createClass({
    displayName: 'UnknownEventDialog',

    propTypes: {
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
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        return (
            <BaseDialog className='mx_UnknownDeviceDialog'
                onFinished={this.props.onFinished}
                title='Room contains unknown devices'
            >
                <GeminiScrollbar autoshow={true} className="mx_Dialog_content">
                    <h4>This room contains devices which have not been
                    verified.</h4>
                    <p>
                        This means there is no guarantee that the devices belong
                        to a rightful user of the room.
                    </p><p>
                        We recommend you go through the verification process
                        for each device before continuing, but you can resend
                        the message without verifying if you prefer.
                    </p>
                    <p>Unknown devices:</p>
                    <UnknownDeviceList devices={this.props.devices} />
                </GeminiScrollbar>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" autoFocus={ true }
                            onClick={ this.props.onFinished } >
                        OK
                    </button>
                </div>
            </BaseDialog>
        );
    },
});
