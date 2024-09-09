/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import InfoDialog from "./InfoDialog";

export const createCantStartVoiceMessageBroadcastDialog = (): void => {
    Modal.createDialog(InfoDialog, {
        title: _t("voice_message|cant_start_broadcast_title"),
        description: <p>{_t("voice_message|cant_start_broadcast_description")}</p>,
        hasCloseButton: true,
    });
};
