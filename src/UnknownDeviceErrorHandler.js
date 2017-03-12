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

import dis from './dispatcher';
import sdk from './index';
import Modal from './Modal';

const onAction = function(payload) {
    if (payload.action === 'unknown_device_error') {
        var UnknownDeviceDialog = sdk.getComponent("dialogs.UnknownDeviceDialog");
        Modal.createDialog(UnknownDeviceDialog, {
            devices: payload.err.devices,
            room: payload.room,
            onFinished: (r) => {
                // XXX: temporary logging to try to diagnose
                // https://github.com/vector-im/riot-web/issues/3148
                console.log('UnknownDeviceDialog closed with '+r);
            },
        }, "mx_Dialog_unknownDevice");
    }
}

let ref = null;

export function startListening () {
    ref = dis.register(onAction);
}

export function stopListening () {
    if (ref) {
        dis.unregister(ref);
        ref = null;
    }
}
