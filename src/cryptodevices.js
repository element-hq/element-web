/*
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

import Resend from './Resend';
import * as sdk from './index';
import dis from './dispatcher/dispatcher';
import Modal from './Modal';
import { _t } from './languageHandler';

/**
 * Mark all given devices as 'known'
 *
 * @param {MatrixClient} matrixClient A MatrixClient
 * @param {Object} devices Map from userid -> deviceid -> deviceinfo
 */
export function markAllDevicesKnown(matrixClient, devices) {
    Object.keys(devices).forEach((userId) => {
        Object.keys(devices[userId]).map((deviceId) => {
            matrixClient.setDeviceKnown(userId, deviceId, true);
        });
    });
}

/**
 * Gets all crypto devices in a room that are marked neither known
 * nor verified.
 *
 * @param {MatrixClient} matrixClient A MatrixClient
 * @param {Room} room js-sdk room object representing the room
 * @return {Promise} A promise which resolves to a map userId->deviceId->{@link
 * module:crypto~DeviceInfo|DeviceInfo}.
 */
export async function getUnknownDevicesForRoom(matrixClient, room) {
    const roomMembers = (await room.getEncryptionTargetMembers()).map((m) => {
        return m.userId;
    });
    const devices = await matrixClient.downloadKeys(roomMembers, false);
    const unknownDevices = {};
    // This is all devices in this room, so find the unknown ones.
    Object.keys(devices).forEach((userId) => {
        Object.keys(devices[userId]).map((deviceId) => {
            const device = devices[userId][deviceId];

            if (device.isUnverified() && !device.isKnown()) {
                if (unknownDevices[userId] === undefined) {
                    unknownDevices[userId] = {};
                }
                unknownDevices[userId][deviceId] = device;
            }
        });
    });
    return unknownDevices;
}

function focusComposer() {
    dis.dispatch({action: 'focus_composer'});
}

/**
 * Show the UnknownDeviceDialog for a given room. The dialog will inform the user
 * that messages they sent to this room have not been sent due to unknown devices
 * being present.
 *
 * @param {MatrixClient} matrixClient A MatrixClient
 * @param {Room} room js-sdk room object representing the room
 */
export function showUnknownDeviceDialogForMessages(matrixClient, room) {
    getUnknownDevicesForRoom(matrixClient, room).then((unknownDevices) => {
        const onSendClicked = () => {
            Resend.resendUnsentEvents(room);
        };

        const UnknownDeviceDialog = sdk.getComponent('dialogs.UnknownDeviceDialog');
        Modal.createTrackedDialog('Unknown Device Dialog', '', UnknownDeviceDialog, {
            room: room,
            devices: unknownDevices,
            sendAnywayLabel: _t("Send anyway"),
            sendLabel: _t("Send"),
            onSend: onSendClicked,
            onFinished: focusComposer,
        }, 'mx_Dialog_unknownDevice');
    });
}

/**
 * Show the UnknownDeviceDialog for a given room. The dialog will inform the user
 * that a call they tried to place or answer in the room couldn't be placed or
 * answered due to unknown devices being present.
 *
 * @param {MatrixClient} matrixClient A MatrixClient
 * @param {Room} room js-sdk room object representing the room
 * @param {func} sendAnyway Function called when the 'call anyway' or 'call'
 *     button is pressed. This should attempt to place or answer the call again.
 * @param {string} sendAnywayLabel Label for the button displayed to retry the call
 *     when unknown devices are still present (eg. "Call Anyway")
 * @param {string} sendLabel Label for the button displayed to retry the call
 *     after all devices have been verified (eg. "Call")
 */
export function showUnknownDeviceDialogForCalls(matrixClient, room, sendAnyway, sendAnywayLabel, sendLabel) {
    getUnknownDevicesForRoom(matrixClient, room).then((unknownDevices) => {
        const UnknownDeviceDialog = sdk.getComponent('dialogs.UnknownDeviceDialog');
        Modal.createTrackedDialog('Unknown Device Dialog', '', UnknownDeviceDialog, {
            room: room,
            devices: unknownDevices,
            sendAnywayLabel: sendAnywayLabel,
            sendLabel: sendLabel,
            onSend: sendAnyway,
        }, 'mx_Dialog_unknownDevice');
    });
}
