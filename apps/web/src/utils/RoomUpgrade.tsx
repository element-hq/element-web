/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { ClientEvent, EventType, type MatrixClient, type Room, type User } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";

import Modal, { type IHandle } from "../Modal";
import { _t } from "../languageHandler";
import ErrorDialog from "../components/views/dialogs/ErrorDialog";
import Spinner from "../components/views/elements/Spinner";
import MultiInviter, { type CompletionStates, type MultiInviterOptions } from "./MultiInviter";
import type { Member } from "./direct-messages.ts";
import BaseAvatar from "../components/views/avatars/BaseAvatar.tsx";
import { mediaFromMxc } from "../customisations/Media.ts";
import { SdkContextClass } from "../contexts/SDKContextClass.ts";

export interface RoomUpgradeProgress {
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
    progressCallback?: (progress: RoomUpgradeProgress) => void,
    inhibitInviteProgressDialog = false,
    additionalCreators?: string[],
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
        parentsToRelink = Array.from(SdkContextClass.instance.spaceStore.getKnownParents(room.roomId))
            .map((roomId) => cli.getRoom(roomId))
            .filter((parent) =>
                parent?.currentState.maySendStateEvent(EventType.SpaceChild, cli.getUserId()!),
            ) as Room[];
    }

    const progress: RoomUpgradeProgress = {
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
        ({ replacement_room: newRoomId } = await cli.upgradeRoom(room.roomId, targetVersion, additionalCreators));
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
        await inviteUsersToRoom(cli, newRoomId, toInvite, {
            progressCallback: () => {
                progress.inviteUsersProgress!++;
                progressCallback?.(progress);
            },
            inhibitProgressDialog: inhibitInviteProgressDialog,
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

async function inviteUsersToRoom(
    client: MatrixClient,
    roomId: string,
    userIds: string[],
    inviteOptions: MultiInviterOptions,
): Promise<void> {
    const inviter = new MultiInviter(client, roomId, inviteOptions);
    const states = await inviter.invite(userIds);
    const room = client.getRoom(roomId)!;
    showAnyInviteErrors(states, room, inviter);
}

export function showAnyInviteErrors(
    states: CompletionStates,
    room: Room,
    inviter: MultiInviter,
    userMap?: Map<string, Member>,
): boolean {
    // Show user any errors
    const failedUsers = Object.keys(states).filter((a) => states[a] === "error");
    if (failedUsers.length === 1 && inviter.fatal) {
        // Just get the first message because there was a fatal problem on the first
        // user. This usually means that no other users were attempted, making it
        // pointless for us to list who failed exactly.
        Modal.createDialog(ErrorDialog, {
            title: _t("invite|room_failed_title", { roomName: room.name }),
            description: inviter.getErrorText(failedUsers[0]),
        });
        return false;
    } else {
        const errorList: string[] = [];
        for (const addr of failedUsers) {
            if (states[addr] === "error") {
                const reason = inviter.getErrorText(addr);
                errorList.push(addr + ": " + reason);
            }
        }

        const cli = room.client;
        if (errorList.length > 0) {
            // React 16 doesn't let us use `errorList.join(<br />)` anymore, so this is our solution
            const description = (
                <div className="mx_InviteDialog_multiInviterError">
                    <h4>
                        {_t(
                            "invite|room_failed_partial",
                            {},
                            {
                                RoomName: () => <strong>{room.name}</strong>,
                            },
                        )}
                    </h4>
                    <div>
                        {failedUsers.map((addr) => {
                            const user = userMap?.get(addr) || cli.getUser(addr);
                            const name = (user as Member).name || (user as User).rawDisplayName;
                            const avatarUrl = (user as Member).getMxcAvatarUrl?.() || (user as User).avatarUrl;
                            return (
                                <div key={addr} className="mx_InviteDialog_tile mx_InviteDialog_tile--inviterError">
                                    <div className="mx_InviteDialog_tile_avatarStack">
                                        <BaseAvatar
                                            url={
                                                (avatarUrl && mediaFromMxc(avatarUrl).getSquareThumbnailHttp(24)) ??
                                                undefined
                                            }
                                            name={name!}
                                            idName={user?.userId}
                                            size="36px"
                                        />
                                    </div>
                                    <div className="mx_InviteDialog_tile_nameStack">
                                        <span className="mx_InviteDialog_tile_nameStack_name">{name}</span>
                                        <span className="mx_InviteDialog_tile_nameStack_userId">{user?.userId}</span>
                                    </div>
                                    <div className="mx_InviteDialog_tile--inviterError_errorText">
                                        {inviter.getErrorText(addr)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );

            Modal.createDialog(ErrorDialog, {
                title: _t("invite|room_failed_partial_title"),
                description,
            });
            return false;
        }
    }

    return true;
}
