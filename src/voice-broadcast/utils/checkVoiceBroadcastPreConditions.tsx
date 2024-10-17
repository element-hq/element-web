/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { MatrixClient, Room, SyncState } from "matrix-js-sdk/src/matrix";

import { hasRoomLiveVoiceBroadcast, VoiceBroadcastInfoEventType, VoiceBroadcastRecordingsStore } from "..";
import InfoDialog from "../../components/views/dialogs/InfoDialog";
import { _t } from "../../languageHandler";
import Modal from "../../Modal";

const showAlreadyRecordingDialog = (): void => {
    Modal.createDialog(InfoDialog, {
        title: _t("voice_broadcast|failed_already_recording_title"),
        description: <p>{_t("voice_broadcast|failed_already_recording_description")}</p>,
        hasCloseButton: true,
    });
};

const showInsufficientPermissionsDialog = (): void => {
    Modal.createDialog(InfoDialog, {
        title: _t("voice_broadcast|failed_insufficient_permission_title"),
        description: <p>{_t("voice_broadcast|failed_insufficient_permission_description")}</p>,
        hasCloseButton: true,
    });
};

const showOthersAlreadyRecordingDialog = (): void => {
    Modal.createDialog(InfoDialog, {
        title: _t("voice_broadcast|failed_others_already_recording_title"),
        description: <p>{_t("voice_broadcast|failed_others_already_recording_description")}</p>,
        hasCloseButton: true,
    });
};

const showNoConnectionDialog = (): void => {
    Modal.createDialog(InfoDialog, {
        title: _t("voice_broadcast|failed_no_connection_title"),
        description: <p>{_t("voice_broadcast|failed_no_connection_description")}</p>,
        hasCloseButton: true,
    });
};

export const checkVoiceBroadcastPreConditions = async (
    room: Room,
    client: MatrixClient,
    recordingsStore: VoiceBroadcastRecordingsStore,
): Promise<boolean> => {
    if (recordingsStore.getCurrent()) {
        showAlreadyRecordingDialog();
        return false;
    }

    const currentUserId = client.getUserId();

    if (!currentUserId) return false;

    if (!room.currentState.maySendStateEvent(VoiceBroadcastInfoEventType, currentUserId)) {
        showInsufficientPermissionsDialog();
        return false;
    }

    if (client.getSyncState() === SyncState.Error) {
        showNoConnectionDialog();
        return false;
    }

    const { hasBroadcast, startedByUser } = await hasRoomLiveVoiceBroadcast(client, room, currentUserId);

    if (hasBroadcast && startedByUser) {
        showAlreadyRecordingDialog();
        return false;
    }

    if (hasBroadcast) {
        showOthersAlreadyRecordingDialog();
        return false;
    }

    return true;
};
