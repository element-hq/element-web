/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2020, 2023 The Matrix.org Foundation C.I.C.

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

import { EventType, MatrixClient } from "matrix-js-sdk/src/matrix";

import { SdkContextClass } from "../contexts/SDKContext";
import { isLocalRoom } from "../utils/localRoom/isLocalRoom";
import Modal from "../Modal";
import UploadConfirmDialog from "../components/views/dialogs/UploadConfirmDialog";
import { RunResult } from "./interface";

export function reject(error?: any): RunResult {
    return { error };
}

export function success(promise: Promise<any> = Promise.resolve()): RunResult {
    return { promise };
}

export function successSync(value: any): RunResult {
    return success(Promise.resolve(value));
}

export const canAffectPowerlevels = (cli: MatrixClient | null): boolean => {
    const roomId = SdkContextClass.instance.roomViewStore.getRoomId();
    if (!cli || !roomId) return false;
    const room = cli?.getRoom(roomId);
    return !!room?.currentState.maySendStateEvent(EventType.RoomPowerLevels, cli.getSafeUserId()) && !isLocalRoom(room);
};

// XXX: workaround for https://github.com/microsoft/TypeScript/issues/31816
interface HTMLInputEvent extends Event {
    target: HTMLInputElement & EventTarget;
}

export const singleMxcUpload = async (cli: MatrixClient): Promise<string | null> => {
    return new Promise((resolve) => {
        const fileSelector = document.createElement("input");
        fileSelector.setAttribute("type", "file");
        fileSelector.onchange = (ev: Event) => {
            const file = (ev as HTMLInputEvent).target.files?.[0];
            if (!file) return;

            Modal.createDialog(UploadConfirmDialog, {
                file,
                onFinished: async (shouldContinue): Promise<void> => {
                    if (shouldContinue) {
                        const { content_uri: uri } = await cli.uploadContent(file);
                        resolve(uri);
                    } else {
                        resolve(null);
                    }
                },
            });
        };

        fileSelector.click();
    });
};

export const isCurrentLocalRoom = (cli: MatrixClient | null): boolean => {
    const roomId = SdkContextClass.instance.roomViewStore.getRoomId();
    if (!roomId) return false;
    const room = cli?.getRoom(roomId);
    if (!room) return false;
    return isLocalRoom(room);
};
