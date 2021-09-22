/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { Room } from "matrix-js-sdk/src/models/room";
import { EventType } from "matrix-js-sdk/src/@types/event";

import { inviteUsersToRoom } from "../RoomInvite";
import Modal from "../Modal";
import { _t } from "../languageHandler";
import ErrorDialog from "../components/views/dialogs/ErrorDialog";
import SpaceStore from "../stores/SpaceStore";
import Spinner from "../components/views/elements/Spinner";

export async function upgradeRoom(
    room: Room,
    targetVersion: string,
    inviteUsers = false,
    handleError = true,
    updateSpaces = true,
    awaitRoom = false,
): Promise<string> {
    const cli = room.client;
    const spinnerModal = Modal.createDialog(Spinner, null, "mx_Dialog_spinner");

    let newRoomId: string;
    try {
        ({ replacement_room: newRoomId } = await cli.upgradeRoom(room.roomId, targetVersion));
    } catch (e) {
        if (!handleError) throw e;
        console.error(e);

        Modal.createTrackedDialog("Room Upgrade Error", "", ErrorDialog, {
            title: _t('Error upgrading room'),
            description: _t('Double check that your server supports the room version chosen and try again.'),
        });
        throw e;
    }

    if (awaitRoom || inviteUsers) {
        await new Promise<void>(resolve => {
            // already have the room
            if (room.client.getRoom(newRoomId)) {
                resolve();
                return;
            }

            // We have to wait for the js-sdk to give us the room back so
            // we can more effectively abuse the MultiInviter behaviour
            // which heavily relies on the Room object being available.
            const checkForRoomFn = (newRoom: Room) => {
                if (newRoom.roomId !== newRoomId) return;
                resolve();
                cli.off("Room", checkForRoomFn);
            };
            cli.on("Room", checkForRoomFn);
        });
    }

    if (inviteUsers) {
        const toInvite = [
            ...room.getMembersWithMembership("join"),
            ...room.getMembersWithMembership("invite"),
        ].map(m => m.userId).filter(m => m !== cli.getUserId());

        if (toInvite.length > 0) {
            // Errors are handled internally to this function
            await inviteUsersToRoom(newRoomId, toInvite);
        }
    }

    if (updateSpaces) {
        const parents = SpaceStore.instance.getKnownParents(room.roomId);
        try {
            for (const parentId of parents) {
                const parent = cli.getRoom(parentId);
                if (!parent?.currentState.maySendStateEvent(EventType.SpaceChild, cli.getUserId())) continue;

                const currentEv = parent.currentState.getStateEvents(EventType.SpaceChild, room.roomId);
                await cli.sendStateEvent(parentId, EventType.SpaceChild, {
                    ...(currentEv?.getContent() || {}), // copy existing attributes like suggested
                    via: [cli.getDomain()],
                }, newRoomId);
                await cli.sendStateEvent(parentId, EventType.SpaceChild, {}, room.roomId);
            }
        } catch (e) {
            // These errors are not critical to the room upgrade itself
            console.warn("Failed to update parent spaces during room upgrade", e);
        }
    }

    spinnerModal.close();
    return newRoomId;
}
