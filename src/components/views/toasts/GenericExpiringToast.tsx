/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import ToastStore from "../../../stores/ToastStore";
import GenericToast, { type IProps as IGenericToastProps } from "./GenericToast";
import { useExpiringCounter } from "../../../hooks/useTimeout";

interface IProps extends IGenericToastProps {
    toastKey: string;
    numSeconds: number;
    dismissLabel: string;
    onDismiss?(): void;
}

const SECOND = 1000;

const GenericExpiringToast: React.FC<IProps> = ({
    description,
    primaryLabel,
    dismissLabel,
    onPrimaryClick,
    onDismiss,
    toastKey,
    numSeconds,
}) => {
    const onReject = (): void => {
        if (onDismiss) onDismiss();
        ToastStore.sharedInstance().dismissToast(toastKey);
    };
    const counter = useExpiringCounter(onReject, SECOND, numSeconds);

    let rejectLabel = dismissLabel;
    if (counter > 0) {
        rejectLabel += ` (${counter})`;
    }

    return (
        <GenericToast
            description={description}
            primaryLabel={primaryLabel}
            onPrimaryClick={onPrimaryClick}
            secondaryLabel={rejectLabel}
            onSecondaryClick={onReject}
        />
    );
};

export default GenericExpiringToast;
