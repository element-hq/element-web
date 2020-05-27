/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { _t } from '../languageHandler';
import { MatrixClientPeg } from '../MatrixClientPeg';
import Modal from '../Modal';
import DeviceListener from '../DeviceListener';
import NewSessionReviewDialog from '../components/views/dialogs/NewSessionReviewDialog';
import ToastStore from "../stores/ToastStore";
import GenericToast from "../components/views/toasts/GenericToast";

function toastKey(deviceId: string) {
    return "unverified_session_" + deviceId;
}

export const showToast = (deviceId: string) => {
    const cli = MatrixClientPeg.get();

    const onAccept = () => {
        Modal.createTrackedDialog('New Session Review', 'Starting dialog', NewSessionReviewDialog, {
            userId: cli.getUserId(),
            device: cli.getStoredDevice(cli.getUserId(), deviceId),
            onFinished: (r) => {
                if (!r) {
                    /* This'll come back false if the user clicks "this wasn't me" and saw a warning dialog */
                    DeviceListener.sharedInstance().dismissUnverifiedSessions([deviceId]);
                }
            },
        }, null, /* priority = */ false, /* static = */ true);
    };

    const onReject = () => {
        DeviceListener.sharedInstance().dismissUnverifiedSessions([deviceId]);
    };

    const device = cli.getStoredDevice(cli.getUserId(), deviceId);

    ToastStore.sharedInstance().addOrReplaceToast({
        key: toastKey(deviceId),
        title: _t("New login. Was this you?"),
        icon: "verification_warning",
        props: {
            description: _t(
                "Verify the new login accessing your account: %(name)s", { name: device.getDisplayName()}),
            acceptLabel: _t("Verify"),
            onAccept,
            rejectLabel: _t("Later"),
            onReject,
        },
        component: GenericToast,
        priority: 80,
    });
};

export const hideToast = (deviceId: string) => {
    ToastStore.sharedInstance().dismissToast(deviceId);
};
