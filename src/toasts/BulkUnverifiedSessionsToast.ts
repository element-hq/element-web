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
import dis from "../dispatcher/dispatcher";
import { MatrixClientPeg } from '../MatrixClientPeg';
import DeviceListener from '../DeviceListener';
import GenericToast from "../components/views/toasts/GenericToast";
import ToastStore from "../stores/ToastStore";

const TOAST_KEY = "reviewsessions";

export const showToast = (deviceIds: Set<string>) => {
    const onAccept = () => {
        DeviceListener.sharedInstance().dismissUnverifiedSessions(deviceIds);

        dis.dispatch({
            action: 'view_user_info',
            userId: MatrixClientPeg.get().getUserId(),
        });
    };

    const onReject = () => {
        DeviceListener.sharedInstance().dismissUnverifiedSessions(deviceIds);
    };

    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: _t("Review where you’re logged in"),
        icon: "verification_warning",
        props: {
            description: _t("Verify all your sessions to ensure your account & messages are safe"),
            acceptLabel: _t("Review"),
            onAccept,
            rejectLabel: _t("Later"),
            onReject,
        },
        component: GenericToast,
        priority: 50,
    });
};

export const hideToast = () => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
