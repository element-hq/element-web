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

import { inviteUsersToRoom } from "../RoomInvite";
import Modal from "../Modal";
import { _t } from "../languageHandler";
import ErrorDialog from "../components/views/dialogs/ErrorDialog";

export async function upgradeRoom(
    room: Room,
    targetVersion: string,
    inviteUsers = false,
    // eslint-disable-next-line camelcase
): Promise<{ replacement_room: string }> {
    const cli = room.client;

    let checkForUpgradeFn: (room: Room) => Promise<void>;
    try {
        const upgradePromise = cli.upgradeRoom(room.roomId, targetVersion);

        // We have to wait for the js-sdk to give us the room back so
        // we can more effectively abuse the MultiInviter behaviour
        // which heavily relies on the Room object being available.
        if (inviteUsers) {
            checkForUpgradeFn = async (newRoom: Room) => {
                // The upgradePromise should be done by the time we await it here.
                const { replacement_room: newRoomId } = await upgradePromise;
                if (newRoom.roomId !== newRoomId) return;

                const toInvite = [
                    ...room.getMembersWithMembership("join"),
                    ...room.getMembersWithMembership("invite"),
                ].map(m => m.userId).filter(m => m !== cli.getUserId());

                if (toInvite.length > 0) {
                    // Errors are handled internally to this function
                    await inviteUsersToRoom(newRoomId, toInvite);
                }

                cli.removeListener('Room', checkForUpgradeFn);
            };
            cli.on('Room', checkForUpgradeFn);
        }

        // We have to await after so that the checkForUpgradesFn has a proper reference
        // to the new room's ID.
        return upgradePromise;
    } catch (e) {
        console.error(e);

        if (checkForUpgradeFn) cli.removeListener('Room', checkForUpgradeFn);

        Modal.createTrackedDialog('Slash Commands', 'room upgrade error', ErrorDialog, {
            title: _t('Error upgrading room'),
            description: _t('Double check that your server supports the room version chosen and try again.'),
        });
        throw e;
    }
}
