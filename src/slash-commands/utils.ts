/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2023 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2018 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { SdkContextClass } from "../contexts/SDKContext";
import { isLocalRoom } from "../utils/localRoom/isLocalRoom";
import Modal from "../Modal";
import UploadConfirmDialog from "../components/views/dialogs/UploadConfirmDialog";
import { type RunResult } from "./interface";

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
