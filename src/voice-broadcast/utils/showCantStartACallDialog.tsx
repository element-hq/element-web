/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import InfoDialog from "../../components/views/dialogs/InfoDialog";
import { _t } from "../../languageHandler";
import Modal from "../../Modal";

export const showCantStartACallDialog = (): void => {
    Modal.createDialog(InfoDialog, {
        title: _t("voip|failed_call_live_broadcast_title"),
        description: <p>{_t("voip|failed_call_live_broadcast_description")}</p>,
        hasCloseButton: true,
    });
};
