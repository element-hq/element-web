/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import { MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { SyncState } from "matrix-js-sdk/src/sync";

import { hasRoomLiveVoiceBroadcast, VoiceBroadcastInfoEventType, VoiceBroadcastRecordingsStore } from "..";
import InfoDialog from "../../components/views/dialogs/InfoDialog";
import { _t } from "../../languageHandler";
import Modal from "../../Modal";

const showAlreadyRecordingDialog = (): void => {
    Modal.createDialog(InfoDialog, {
        title: _t("Can't start a new voice broadcast"),
        description: (
            <p>
                {_t(
                    "You are already recording a voice broadcast. " +
                        "Please end your current voice broadcast to start a new one.",
                )}
            </p>
        ),
        hasCloseButton: true,
    });
};

const showInsufficientPermissionsDialog = (): void => {
    Modal.createDialog(InfoDialog, {
        title: _t("Can't start a new voice broadcast"),
        description: (
            <p>
                {_t(
                    "You don't have the required permissions to start a voice broadcast in this room. " +
                        "Contact a room administrator to upgrade your permissions.",
                )}
            </p>
        ),
        hasCloseButton: true,
    });
};

const showOthersAlreadyRecordingDialog = (): void => {
    Modal.createDialog(InfoDialog, {
        title: _t("Can't start a new voice broadcast"),
        description: (
            <p>
                {_t(
                    "Someone else is already recording a voice broadcast. " +
                        "Wait for their voice broadcast to end to start a new one.",
                )}
            </p>
        ),
        hasCloseButton: true,
    });
};

const showNoConnectionDialog = (): void => {
    Modal.createDialog(InfoDialog, {
        title: _t("Connection error"),
        description: <p>{_t("Unfortunately we're unable to start a recording right now. Please try again later.")}</p>,
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
