/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room, EventType, ClientEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";

import { inviteUsersToRoom } from "../RoomInvite";
import Modal, { type IHandle } from "../Modal";
import { _t } from "../languageHandler";
import ErrorDialog from "../components/views/dialogs/ErrorDialog";
import SpaceStore from "../stores/spaces/SpaceStore";
import Spinner from "../components/views/elements/Spinner";

interface IProgress {
    roomUpgraded: boolean;
    roomSynced?: boolean;
    inviteUsersProgress?: number;
    inviteUsersTotal: number;
    updateSpacesProgress?: number;
    updateSpacesTotal: number;
}

export async function awaitRoomDownSync(cli: MatrixClient, roomId: string): Promise<Room> {
    const room = cli.getRoom(roomId);
    if (room) return room; // already have the room

    return new Promise<Room>((resolve) => {
        // We have to wait for the js-sdk to give us the room back so
        // we can more effectively abuse the MultiInviter behaviour
        // which heavily relies on the Room object being available.
        const checkForRoomFn = (room: Room): void => {
            if (room.roomId !== roomId) return;
            resolve(room);
            cli.off(ClientEvent.Room, checkForRoomFn);
        };
        cli.on(ClientEvent.Room, checkForRoomFn);
    });
}

export async function upgradeRoom(
    room: Room,
    targetVersion: string,
    inviteUsers = false,
    handleError = true,
    updateSpaces = true,
    awaitRoom = false,
    progressCallback?: (progress: IProgress) => void,
): Promise<string> {
    const cli = room.client;
    let spinnerModal: IHandle<any> | undefined;
    if (!progressCallback) {
        spinnerModal = Modal.createDialog(Spinner, undefined, "mx_Dialog_spinner");
    }

    let toInvite: string[] = [];
    if (inviteUsers) {
        toInvite = [
            ...room.getMembersWithMembership(KnownMembership.Join),
            ...room.getMembersWithMembership(KnownMembership.Invite),
        ]
            .map((m) => m.userId)
            .filter((m) => m !== cli.getUserId());
    }

    let parentsToRelink: Room[] = [];
    if (updateSpaces) {
        parentsToRelink = Array.from(SpaceStore.instance.getKnownParents(room.roomId))
            .map((roomId) => cli.getRoom(roomId))
            .filter((parent) =>
                parent?.currentState.maySendStateEvent(EventType.SpaceChild, cli.getUserId()!),
            ) as Room[];
    }

    const progress: IProgress = {
        roomUpgraded: false,
        roomSynced: awaitRoom || inviteUsers ? false : undefined,
        inviteUsersProgress: inviteUsers ? 0 : undefined,
        inviteUsersTotal: toInvite.length,
        updateSpacesProgress: updateSpaces ? 0 : undefined,
        updateSpacesTotal: parentsToRelink.length,
    };
    progressCallback?.(progress);

    let newRoomId: string;
    try {
        ({ replacement_room: newRoomId } = await cli.upgradeRoom(room.roomId, targetVersion));
    } catch (e) {
        if (!handleError) throw e;
        logger.error(e);

        Modal.createDialog(ErrorDialog, {
            title: _t("room|upgrade_error_title"),
            description: _t("room|upgrade_error_description"),
        });
        throw e;
    }

    progress.roomUpgraded = true;
    progressCallback?.(progress);

    if (awaitRoom || inviteUsers) {
        await awaitRoomDownSync(room.client, newRoomId);
        progress.roomSynced = true;
        progressCallback?.(progress);
    }

    if (toInvite.length > 0) {
        // Errors are handled internally to this function
        await inviteUsersToRoom(cli, newRoomId, toInvite, () => {
            progress.inviteUsersProgress!++;
            progressCallback?.(progress);
        });
    }

    if (parentsToRelink.length > 0) {
        try {
            for (const parent of parentsToRelink) {
                const currentEv = parent.currentState.getStateEvents(EventType.SpaceChild, room.roomId);
                await cli.sendStateEvent(
                    parent.roomId,
                    EventType.SpaceChild,
                    {
                        ...(currentEv?.getContent() || {}), // copy existing attributes like suggested
                        via: [cli.getDomain()!],
                    },
                    newRoomId,
                );
                await cli.sendStateEvent(parent.roomId, EventType.SpaceChild, {}, room.roomId);

                progress.updateSpacesProgress!++;
                progressCallback?.(progress);
            }
        } catch (e) {
            // These errors are not critical to the room upgrade itself
            logger.warn("Failed to update parent spaces during room upgrade", e);
        }
    }

    spinnerModal?.close();
    return newRoomId;
}
