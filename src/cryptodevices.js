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
import sdk from './index';
import Modal from './Modal';
import { _t } from './languageHandler';

/**
 * Gets all crypto devices in a room that are marked neither known
 * nor verified.
 *
 * @param {MatrixClient} matrixClient A MatrixClient
 * @param {Room} room js-sdk room object representing the room
 * @return {Promise} A promise which resolves to a map userId->deviceId->{@link
 * module:crypto~DeviceInfo|DeviceInfo}.
 */
export function getUnknownDevicesForRoom(matrixClient, room) {
    const roomMembers = room.getJoinedMembers().map((m) => {
        return m.userId;
    });
    return matrixClient.downloadKeys(roomMembers, false).then((devices) => {
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
    });
}

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
        }, 'mx_Dialog_unknownDevice');
    });
}

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
