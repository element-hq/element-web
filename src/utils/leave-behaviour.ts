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

import { sleep } from "matrix-js-sdk/src/utils";
import React, { ReactNode } from "react";
import { EventStatus } from "matrix-js-sdk/src/models/event-status";
import { MatrixEventEvent } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";

import Modal, { IHandle } from "../Modal";
import Spinner from "../components/views/elements/Spinner";
import { _t } from "../languageHandler";
import ErrorDialog from "../components/views/dialogs/ErrorDialog";
import { isMetaSpace } from "../stores/spaces";
import SpaceStore from "../stores/spaces/SpaceStore";
import dis from "../dispatcher/dispatcher";
import { ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../dispatcher/actions";
import { ViewHomePagePayload } from "../dispatcher/payloads/ViewHomePagePayload";
import LeaveSpaceDialog from "../components/views/dialogs/LeaveSpaceDialog";
import { AfterLeaveRoomPayload } from "../dispatcher/payloads/AfterLeaveRoomPayload";
import { bulkSpaceBehaviour } from "./space";
import { SdkContextClass } from "../contexts/SDKContext";
import SettingsStore from "../settings/SettingsStore";

export async function leaveRoomBehaviour(
    matrixClient: MatrixClient,
    roomId: string,
    retry = true,
    spinner = true,
): Promise<void> {
    let spinnerModal: IHandle<any> | undefined;
    if (spinner) {
        spinnerModal = Modal.createDialog(Spinner, undefined, "mx_Dialog_spinner");
    }

    let leavingAllVersions = true;
    const history = matrixClient.getRoomUpgradeHistory(
        roomId,
        false,
        SettingsStore.getValue("feature_dynamic_room_predecessors"),
    );
    if (history && history.length > 0) {
        const currentRoom = history[history.length - 1];
        if (currentRoom.roomId !== roomId) {
            // The user is trying to leave an older version of the room. Let them through
            // without making them leave the current version of the room.
            leavingAllVersions = false;
        }
    }

    const room = matrixClient.getRoom(roomId);

    // should not encounter this
    if (!room) {
        throw new Error(`Expected to find room for id ${roomId}`);
    }

    // await any queued messages being sent so that they do not fail
    await Promise.all(
        room
            .getPendingEvents()
            .filter((ev) => {
                return [EventStatus.QUEUED, EventStatus.ENCRYPTING, EventStatus.SENDING].includes(ev.status!);
            })
            .map(
                (ev) =>
                    new Promise<void>((resolve, reject) => {
                        const handler = (): void => {
                            if (ev.status === EventStatus.NOT_SENT) {
                                spinnerModal?.close();
                                reject(ev.error);
                            }

                            if (!ev.status || ev.status === EventStatus.SENT) {
                                ev.off(MatrixEventEvent.Status, handler);
                                resolve();
                            }
                        };

                        ev.on(MatrixEventEvent.Status, handler);
                    }),
            ),
    );

    let results: { [roomId: string]: Error | MatrixError | null } = {};
    if (!leavingAllVersions) {
        try {
            await matrixClient.leave(roomId);
        } catch (e) {
            if (e instanceof MatrixError) {
                const message = e.data.error || _t("Unexpected server error trying to leave the room");
                results[roomId] = Object.assign(new Error(message), { errcode: e.data.errcode, data: e.data });
            } else {
                results[roomId] = e || new Error("Failed to leave room for unknown causes");
            }
        }
    } else {
        results = await matrixClient.leaveRoomChain(roomId, retry);
    }

    if (retry) {
        const limitExceededError = Object.values(results).find(
            (e) => (e as MatrixError)?.errcode === "M_LIMIT_EXCEEDED",
        ) as MatrixError;
        if (limitExceededError) {
            await sleep(limitExceededError.data.retry_after_ms ?? 100);
            return leaveRoomBehaviour(matrixClient, roomId, false, false);
        }
    }

    spinnerModal?.close();

    const errors = Object.entries(results).filter((r) => !!r[1]);
    if (errors.length > 0) {
        const messages: ReactNode[] = [];
        for (const roomErr of errors) {
            const err = roomErr[1] as MatrixError; // [0] is the roomId
            let message = _t("Unexpected server error trying to leave the room");
            if (err?.errcode && err.message) {
                if (err.errcode === "M_CANNOT_LEAVE_SERVER_NOTICE_ROOM") {
                    Modal.createDialog(ErrorDialog, {
                        title: _t("Can't leave Server Notices room"),
                        description: _t(
                            "This room is used for important messages from the Homeserver, " +
                                "so you cannot leave it.",
                        ),
                    });
                    return;
                }
                message = results[roomId]!.message;
            }
            messages.push(message, React.createElement("BR")); // createElement to avoid using a tsx file in utils
        }
        Modal.createDialog(ErrorDialog, {
            title: _t("Error leaving room"),
            description: messages,
        });
        return;
    }

    if (SdkContextClass.instance.roomViewStore.getRoomId() === roomId) {
        // We were viewing the room that was just left. In order to avoid
        // accidentally viewing the next room in the list and clearing its
        // notifications, switch to a neutral ground such as the home page or
        // space landing page.
        if (isMetaSpace(SpaceStore.instance.activeSpace)) {
            dis.dispatch<ViewHomePagePayload>({ action: Action.ViewHomePage });
        } else if (SpaceStore.instance.activeSpace === roomId) {
            // View the parent space, if there is one
            const parent = SpaceStore.instance.getCanonicalParent(roomId);
            if (parent !== null) {
                dis.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    room_id: parent.roomId,
                    metricsTrigger: undefined, // other
                });
            } else {
                dis.dispatch<ViewHomePagePayload>({ action: Action.ViewHomePage });
            }
        } else {
            dis.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: SpaceStore.instance.activeSpace,
                metricsTrigger: undefined, // other
            });
        }
    }
}

export const leaveSpace = (space: Room): void => {
    Modal.createDialog(
        LeaveSpaceDialog,
        {
            space,
            onFinished: async (leave: boolean, rooms: Room[]): Promise<void> => {
                if (!leave) return;
                await bulkSpaceBehaviour(space, rooms, (room) => leaveRoomBehaviour(space.client, room.roomId));

                dis.dispatch<AfterLeaveRoomPayload>({
                    action: Action.AfterLeaveRoom,
                    room_id: space.roomId,
                });
            },
        },
        "mx_LeaveSpaceDialog_wrapper",
    );
};
