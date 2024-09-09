/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { Icon as WarningIcon } from "../../../../res/img/compound/error-16px.svg";

interface Props {
    message: string;
}

export const VoiceBroadcastError: React.FC<Props> = ({ message }) => {
    return (
        <div className="mx_VoiceBroadcastRecordingConnectionError">
            <WarningIcon className="mx_Icon mx_Icon_16" />
            {message}
        </div>
    );
};
