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

import React from "react";

import { _t, _td } from "../languageHandler";
import GenericToast from "../components/views/toasts/GenericToast";
import ToastStore from "../stores/ToastStore";
import {messageForResourceLimitError} from "../utils/ErrorUtils";

const TOAST_KEY = "serverlimit";

export const showToast = (limitType: string, adminContact?: string, syncError?: boolean) => {
    const errorText = messageForResourceLimitError(limitType, adminContact, {
        'monthly_active_user': _td("Your homeserver has exceeded its user limit."),
        '': _td("Your homeserver has exceeded one of its resource limits."),
    });
    const contactText = messageForResourceLimitError(limitType, adminContact, {
        '': _td("Contact your <a>server admin</a>."),
    });

    ToastStore.sharedInstance().addOrReplaceToast({
        key: TOAST_KEY,
        title: _t("Warning"),
        props: {
            description: <React.Fragment>{errorText} {contactText}</React.Fragment>,
            acceptLabel: _t("Ok"),
            onAccept: hideToast,
        },
        component: GenericToast,
        priority: 70,
    });
};

export const hideToast = () => {
    ToastStore.sharedInstance().dismissToast(TOAST_KEY);
};
