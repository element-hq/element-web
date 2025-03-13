/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps } from "react";
import { type Room, type MatrixEvent, type MatrixClient, type User, EventType } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import MultiInviter, { type CompletionStates } from "./utils/MultiInviter";
import Modal from "./Modal";
import { _t } from "./languageHandler";
import InviteDialog from "./components/views/dialogs/InviteDialog";
import BaseAvatar from "./components/views/avatars/BaseAvatar";
import { mediaFromMxc } from "./customisations/Media";
import ErrorDialog from "./components/views/dialogs/ErrorDialog";
import { InviteKind } from "./components/views/dialogs/InviteDialogTypes";
import { type Member } from "./utils/direct-messages";

export interface IInviteResult {
    states: CompletionStates;
    inviter: MultiInviter;
}

/**
 * Invites multiple addresses to a room
 * Simpler interface to utils/MultiInviter but with
 * no option to cancel.
 *
 * @param {string} roomId The ID of the room to invite to
 * @param {string[]} addresses Array of strings of addresses to invite. May be matrix IDs or 3pids.
 * @param {function} progressCallback optional callback, fired after each invite.
 * @returns {Promise} Promise
 */
export async function inviteMultipleToRoom(
    client: MatrixClient,
    roomId: string,
    addresses: string[],
    progressCallback?: () => void,
): Promise<IInviteResult> {
    const inviter = new MultiInviter(client, roomId, progressCallback);
    return { states: await inviter.invite(addresses), inviter };
}

export function showStartChatInviteDialog(initialText = ""): void {
    // This dialog handles the room creation internally - we don't need to worry about it.
    Modal.createDialog(
        InviteDialog,
        { kind: InviteKind.Dm, initialText },
        /*className=*/ "mx_InviteDialog_flexWrapper",
        /*isPriority=*/ false,
        /*isStatic=*/ true,
    );
}

export function showRoomInviteDialog(roomId: string, initialText = ""): void {
    // This dialog handles the room creation internally - we don't need to worry about it.
    Modal.createDialog(
        InviteDialog,
        {
            kind: InviteKind.Invite,
            initialText,
            roomId,
        } as Omit<ComponentProps<typeof InviteDialog>, "onFinished">,
        /*className=*/ "mx_InviteDialog_flexWrapper",
        /*isPriority=*/ false,
        /*isStatic=*/ true,
    );
}

/**
 * Checks if the given MatrixEvent is a valid 3rd party user invite.
 * @param {MatrixEvent} event The event to check
 * @returns {boolean} True if valid, false otherwise
 */
export function isValid3pidInvite(event: MatrixEvent): boolean {
    if (!event || event.getType() !== EventType.RoomThirdPartyInvite) return false;

    // any events without these keys are not valid 3pid invites, so we ignore them
    const requiredKeys = ["key_validity_url", "public_key", "display_name"];
    if (requiredKeys.some((key) => !event.getContent()[key])) {
        return false;
    }

    // Valid enough by our standards
    return true;
}

export function inviteUsersToRoom(
    client: MatrixClient,
    roomId: string,
    userIds: string[],
    progressCallback?: () => void,
): Promise<void> {
    return inviteMultipleToRoom(client, roomId, userIds, progressCallback)
        .then((result) => {
            const room = client.getRoom(roomId)!;
            showAnyInviteErrors(result.states, room, result.inviter);
        })
        .catch((err) => {
            logger.error(err.stack);
            Modal.createDialog(ErrorDialog, {
                title: _t("invite|failed_title"),
                description: err?.message ?? _t("invite|failed_generic"),
            });
        });
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
