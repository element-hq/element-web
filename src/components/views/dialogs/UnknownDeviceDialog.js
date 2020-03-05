/*
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd

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
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import * as sdk from '../../../index';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import { _t } from '../../../languageHandler';
import SettingsStore from "../../../settings/SettingsStore";
import { markAllDevicesKnown } from '../../../cryptodevices';

function UserUnknownDeviceList(props) {
    const MemberDeviceInfo = sdk.getComponent('rooms.MemberDeviceInfo');
    const {userId, userDevices} = props;

    const deviceListEntries = Object.keys(userDevices).map((deviceId) =>
        <li key={deviceId}><MemberDeviceInfo device={userDevices[deviceId]} userId={userId} showDeviceId={true} /></li>,
    );

    return (
        <ul className="mx_UnknownDeviceDialog_deviceList">
            { deviceListEntries }
        </ul>
    );
}

UserUnknownDeviceList.propTypes = {
    userId: PropTypes.string.isRequired,

    // map from deviceid -> deviceinfo
    userDevices: PropTypes.object.isRequired,
};


function UnknownDeviceList(props) {
    const {devices} = props;

    const userListEntries = Object.keys(devices).map((userId) =>
        <li key={userId}>
            <p>{ userId }:</p>
            <UserUnknownDeviceList userId={userId} userDevices={devices[userId]} />
        </li>,
    );

    return <ul>{ userListEntries }</ul>;
}

UnknownDeviceList.propTypes = {
    // map from userid -> deviceid -> deviceinfo
    devices: PropTypes.object.isRequired,
};


export default createReactClass({
    displayName: 'UnknownDeviceDialog',

    propTypes: {
        room: PropTypes.object.isRequired,

        // map from userid -> deviceid -> deviceinfo or null if devices are not yet loaded
        devices: PropTypes.object,

        onFinished: PropTypes.func.isRequired,

        // Label for the button that marks all devices known and tries the send again
        sendAnywayLabel: PropTypes.string.isRequired,

        // Label for the button that to send the event if you've verified all devices
        sendLabel: PropTypes.string.isRequired,

        // function to retry the request once all devices are verified / known
        onSend: PropTypes.func.isRequired,
    },

    componentWillMount: function() {
        MatrixClientPeg.get().on("deviceVerificationChanged", this._onDeviceVerificationChanged);
    },

    componentWillUnmount: function() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("deviceVerificationChanged", this._onDeviceVerificationChanged);
        }
    },

    _onDeviceVerificationChanged: function(userId, deviceId, deviceInfo) {
        if (this.props.devices[userId] && this.props.devices[userId][deviceId]) {
            // XXX: Mutating props :/
            this.props.devices[userId][deviceId] = deviceInfo;
            this.forceUpdate();
        }
    },

    _onDismissClicked: function() {
        this.props.onFinished();
    },

    _onSendAnywayClicked: function() {
        markAllDevicesKnown(MatrixClientPeg.get(), this.props.devices);

        this.props.onFinished();
        this.props.onSend();
    },

    _onSendClicked: function() {
        this.props.onFinished();
        this.props.onSend();
    },

    render: function() {
        const GeminiScrollbarWrapper = sdk.getComponent("elements.GeminiScrollbarWrapper");
        if (this.props.devices === null) {
            const Spinner = sdk.getComponent("elements.Spinner");
            return <Spinner />;
        }

        let warning;
        if (SettingsStore.getValue("blacklistUnverifiedDevices", this.props.room.roomId)) {
            warning = (
                <h4>
                    { _t("You are currently blacklisting unverified sessions; to send " +
                    "messages to these sessions you must verify them.") }
                </h4>
            );
        } else {
            warning = (
                <div>
                    <p>
                        { _t("We recommend you go through the verification process " +
                            "for each session to confirm they belong to their legitimate owner, " +
                            "but you can resend the message without verifying if you prefer.") }
                    </p>
                </div>
            );
        }

        let haveUnknownDevices = false;
        Object.keys(this.props.devices).forEach((userId) => {
            Object.keys(this.props.devices[userId]).map((deviceId) => {
                const device = this.props.devices[userId][deviceId];
                if (device.isUnverified() && !device.isKnown()) {
                    haveUnknownDevices = true;
                }
            });
        });
        const sendButtonOnClick = haveUnknownDevices ? this._onSendAnywayClicked : this._onSendClicked;
        const sendButtonLabel = haveUnknownDevices ? this.props.sendAnywayLabel : this.props.sendAnywayLabel;

        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return (
            <BaseDialog className='mx_UnknownDeviceDialog'
                onFinished={this.props.onFinished}
                title={_t('Room contains unknown sessions')}
                contentId='mx_Dialog_content'
            >
                <GeminiScrollbarWrapper autoshow={false} className="mx_Dialog_content" id='mx_Dialog_content'>
                    <h4>
                        { _t('"%(RoomName)s" contains sessions that you haven\'t seen before.', {RoomName: this.props.room.name}) }
                    </h4>
                    { warning }
                    { _t("Unknown sessions") }:

                    <UnknownDeviceList devices={this.props.devices} />
                </GeminiScrollbarWrapper>
                <DialogButtons primaryButton={sendButtonLabel}
                    onPrimaryButtonClick={sendButtonOnClick}
                    onCancel={this._onDismissClicked} />
            </BaseDialog>
        );
        // XXX: do we want to give the user the option to enable blacklistUnverifiedDevices for this room (or globally) at this point?
        // It feels like confused users will likely turn it on and then disappear in a cloud of UISIs...
    },
});
