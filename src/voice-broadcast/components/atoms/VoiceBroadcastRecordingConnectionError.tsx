/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { WarningIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";

export const VoiceBroadcastRecordingConnectionError: React.FC = () => {
    return (
        <div className="mx_VoiceBroadcastRecordingConnectionError">
            <WarningIcon className="mx_Icon mx_Icon_16" />
            {_t("voice_broadcast|connection_error")}
        </div>
    );
};
