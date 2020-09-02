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

import ToastStore from "../../../stores/ToastStore";
import GenericToast, { IProps as IGenericToastProps } from "./GenericToast";
import {useExpiringCounter} from "../../../hooks/useTimeout";

interface IProps extends IGenericToastProps {
    toastKey: string;
    numSeconds: number;
    dismissLabel: string;
    onDismiss?();
}

const SECOND = 1000;

const GenericExpiringToast: React.FC<IProps> = ({
    description,
    acceptLabel,
    dismissLabel,
    onAccept,
    onDismiss,
    toastKey,
    numSeconds,
}) => {
    const onReject = () => {
        if (onDismiss) onDismiss();
        ToastStore.sharedInstance().dismissToast(toastKey);
    };
    const counter = useExpiringCounter(onReject, SECOND, numSeconds);

    let rejectLabel = dismissLabel;
    if (counter > 0) {
        rejectLabel += ` (${counter})`;
    }

    return <GenericToast
        description={description}
        acceptLabel={acceptLabel}
        onAccept={onAccept}
        rejectLabel={rejectLabel}
        onReject={onReject}
    />;
};

export default GenericExpiringToast;
