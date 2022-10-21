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
import { ISendEventResponse, MatrixClient, Room, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { defer } from "matrix-js-sdk/src/utils";

import { _t } from "../../languageHandler";
import InfoDialog from "../../components/views/dialogs/InfoDialog";
import Modal from "../../Modal";
import {
    VoiceBroadcastInfoEventContent,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
    VoiceBroadcastRecordingsStore,
    VoiceBroadcastRecording,
    hasRoomLiveVoiceBroadcast,
    getChunkLength,
} from "..";

const startBroadcast = async (
    room: Room,
    client: MatrixClient,
    recordingsStore: VoiceBroadcastRecordingsStore,
): Promise<VoiceBroadcastRecording> => {
    const { promise, resolve } = defer<VoiceBroadcastRecording>();
    let result: ISendEventResponse = null;

    const onRoomStateEvents = () => {
        if (!result) return;

        const voiceBroadcastEvent = room.currentState.getStateEvents(
            VoiceBroadcastInfoEventType,
            client.getUserId(),
        );

        if (voiceBroadcastEvent?.getId() === result.event_id) {
            room.off(RoomStateEvent.Events, onRoomStateEvents);
            const recording = new VoiceBroadcastRecording(
                voiceBroadcastEvent,
                client,
            );
            recordingsStore.setCurrent(recording);
            recording.start();
            resolve(recording);
        }
    };

    room.on(RoomStateEvent.Events, onRoomStateEvents);

    // XXX Michael W: refactor to live event
    result = await client.sendStateEvent(
        room.roomId,
        VoiceBroadcastInfoEventType,
        {
            device_id: client.getDeviceId(),
            state: VoiceBroadcastInfoState.Started,
            chunk_length: getChunkLength(),
        } as VoiceBroadcastInfoEventContent,
        client.getUserId(),
    );

    return promise;
};

const showAlreadyRecordingDialog = () => {
    Modal.createDialog(InfoDialog, {
        title: _t("Can't start a new voice broadcast"),
        description: <p>{ _t("You are already recording a voice broadcast. "
                             + "Please end your current voice broadcast to start a new one.") }</p>,
        hasCloseButton: true,
    });
};

const showInsufficientPermissionsDialog = () => {
    Modal.createDialog(InfoDialog, {
        title: _t("Can't start a new voice broadcast"),
        description: <p>{ _t("You don't have the required permissions to start a voice broadcast in this room. "
                             + "Contact a room administrator to upgrade your permissions.") }</p>,
        hasCloseButton: true,
    });
};

const showOthersAlreadyRecordingDialog = () => {
    Modal.createDialog(InfoDialog, {
        title: _t("Can't start a new voice broadcast"),
        description: <p>{ _t("Someone else is already recording a voice broadcast. "
                             + "Wait for their voice broadcast to end to start a new one.") }</p>,
        hasCloseButton: true,
    });
};

/**
 * Starts a new Voice Broadcast Recording, if
 * - the user has the permissions to do so in the room
 * - there is no other broadcast being recorded in the room, yet
 * Sends a voice_broadcast_info state event and waits for the event to actually appear in the room state.
 */
export const startNewVoiceBroadcastRecording = async (
    room: Room,
    client: MatrixClient,
    recordingsStore: VoiceBroadcastRecordingsStore,
): Promise<VoiceBroadcastRecording | null> => {
    if (recordingsStore.getCurrent()) {
        showAlreadyRecordingDialog();
        return null;
    }

    const currentUserId = client.getUserId();

    if (!room.currentState.maySendStateEvent(VoiceBroadcastInfoEventType, currentUserId)) {
        showInsufficientPermissionsDialog();
        return null;
    }

    const { hasBroadcast, startedByUser } = hasRoomLiveVoiceBroadcast(room, currentUserId);

    if (hasBroadcast && startedByUser) {
        showAlreadyRecordingDialog();
        return null;
    }

    if (hasBroadcast) {
        showOthersAlreadyRecordingDialog();
        return null;
    }

    return startBroadcast(room, client, recordingsStore);
};
