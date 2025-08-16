/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixError, type MatrixClient, EventType, type EmptyObject, type InviteOpts } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";

import { AddressType, getAddressType } from "../UserAddress";
import { _t } from "../languageHandler";
import Modal from "../Modal";
import SettingsStore from "../settings/SettingsStore";
import AskInviteAnywayDialog from "../components/views/dialogs/AskInviteAnywayDialog";
import ConfirmUserActionDialog from "../components/views/dialogs/ConfirmUserActionDialog";
import { openInviteProgressDialog } from "../components/views/dialogs/InviteProgressDialog.tsx";

export enum InviteState {
    Invited = "invited",
    Error = "error",
}

interface IError {
    errorText: string;
    errcode: string;
}

export const UNKNOWN_PROFILE_ERRORS = [
    "M_NOT_FOUND",
    "M_USER_NOT_FOUND",
    "M_PROFILE_UNDISCLOSED",
    "M_PROFILE_NOT_FOUND",
];

export type CompletionStates = Record<string, InviteState>;

const USER_ALREADY_JOINED = "IO.ELEMENT.ALREADY_JOINED";
const USER_ALREADY_INVITED = "IO.ELEMENT.ALREADY_INVITED";
const USER_BANNED = "IO.ELEMENT.BANNED";

/** Options interface for {@link MultiInviter} */
export interface MultiInviterOptions {
    /** Optional callback, fired after each invite */
    progressCallback?: () => void;

    /**
     * By default, we will pop up a "Preparing invitations..." dialog while the invites are being sent. Set this to
     * `true` to inhibit it (in which case, you probably want to implement another bit of feedback UI).
     */
    inhibitProgressDialog?: boolean;
}

/**
 * Invites multiple addresses to a room, handling rate limiting from the server
 */
export default class MultiInviter {
    private addresses: string[] = [];
    private _fatal = false;
    private completionStates: CompletionStates = {}; // State of each address (invited or error)
    private errors: Record<string, IError> = {}; // { address: {errorText, errcode} }
    private reason: string | undefined;

    /**
     * @param matrixClient the client of the logged in user
     * @param {string} roomId The ID of the room to invite to
     * @param options Options object
     */
    public constructor(
        private readonly matrixClient: MatrixClient,
        private roomId: string,
        private readonly options: MultiInviterOptions = {},
    ) {}

    public get fatal(): boolean {
        return this._fatal;
    }

    /**
     * Invite users to this room. This may only be called once per
     * instance of the class.
     *
     * Any failures are returned via the {@link CompletionStates} in the result.
     *
     * @param {array} addresses Array of addresses to invite
     * @param {string} reason Reason for inviting (optional)
     * @returns {Promise} Resolved when all invitations in the queue are complete.
     */
    public async invite(addresses: string[], reason?: string): Promise<CompletionStates> {
        if (this.addresses.length > 0) {
            throw new Error("Already inviting/invited");
        }
        this.addresses.push(...addresses);
        this.reason = reason;

        let closeDialog: (() => void) | undefined;
        if (!this.options.inhibitProgressDialog) {
            closeDialog = openInviteProgressDialog();
        }

        try {
            for (const addr of this.addresses) {
                if (getAddressType(addr) === null) {
                    this.completionStates[addr] = InviteState.Error;
                    this.errors[addr] = {
                        errcode: "M_INVALID",
                        errorText: _t("invite|invalid_address"),
                    };
                }
            }

            for (const addr of this.addresses) {
                // don't try to invite it if it's an invalid address
                // (it will already be marked as an error though,
                // so no need to do so again)
                if (getAddressType(addr) === null) {
                    continue;
                }

                // don't re-invite (there's no way in the UI to do this, but
                // for sanity's sake)
                if (this.completionStates[addr] === InviteState.Invited) {
                    continue;
                }

                await this.doInvite(addr, false);

                if (this._fatal) {
                    // `doInvite` suffered a fatal error. The error should have been recorded in `errors`; it's up
                    // to the caller to report back to the user.
                    return this.completionStates;
                }
            }

            if (Object.keys(this.errors).length > 0) {
                // There were problems inviting some people - see if we can invite them
                // without caring if they exist or not.
                const unknownProfileUsers = Object.keys(this.errors).filter((a) =>
                    UNKNOWN_PROFILE_ERRORS.includes(this.errors[a].errcode),
                );

                if (unknownProfileUsers.length > 0) {
                    await this.handleUnknownProfileUsers(unknownProfileUsers);
                }
            }
        } finally {
            // Remember to close the progress dialog, if we opened one.
            closeDialog?.();
        }

        return this.completionStates;
    }

    public getCompletionState(addr: string): InviteState {
        return this.completionStates[addr];
    }

    public getErrorText(addr: string): string | null {
        return this.errors[addr]?.errorText ?? null;
    }

    private async inviteToRoom(roomId: string, addr: string, ignoreProfile = false): Promise<EmptyObject> {
        const addrType = getAddressType(addr);

        if (addrType === AddressType.Email) {
            return this.matrixClient.inviteByEmail(roomId, addr);
        } else if (addrType === AddressType.MatrixUserId) {
            const room = this.matrixClient.getRoom(roomId);
            if (!room) throw new Error("Room not found");

            const member = room.getMember(addr);
            if (member?.membership === KnownMembership.Join) {
                throw new MatrixError({
                    errcode: USER_ALREADY_JOINED,
                    error: "Member already joined",
                });
            } else if (member?.membership === KnownMembership.Invite) {
                throw new MatrixError({
                    errcode: USER_ALREADY_INVITED,
                    error: "Member already invited",
                });
            } else if (member?.membership === KnownMembership.Ban) {
                let proceed = false;
                // Check if we can unban the invitee.
                // See https://spec.matrix.org/v1.7/rooms/v10/#authorization-rules, particularly 4.5.3 and 4.5.4.
                const ourMember = room.getMember(this.matrixClient.getSafeUserId());
                if (
                    !!ourMember &&
                    member.powerLevel < ourMember.powerLevel &&
                    room.currentState.hasSufficientPowerLevelFor("ban", ourMember.powerLevel) &&
                    room.currentState.hasSufficientPowerLevelFor("kick", ourMember.powerLevel)
                ) {
                    const { finished } = Modal.createDialog(ConfirmUserActionDialog, {
                        member,
                        action: _t("action|unban"),
                        title: _t("invite|unban_first_title"),
                    });
                    [proceed = false] = await finished;
                    if (proceed) {
                        await this.matrixClient.unban(roomId, member.userId);
                    }
                }

                if (!proceed) {
                    throw new MatrixError({
                        errcode: USER_BANNED,
                        error: "Member is banned",
                    });
                }
            }

            if (!ignoreProfile && SettingsStore.getValue("promptBeforeInviteUnknownUsers", this.roomId)) {
                try {
                    await this.matrixClient.getProfileInfo(addr);
                } catch (err) {
                    // The error handling during the invitation process covers any API.
                    // Some errors must to me mapped from profile API errors to more specific ones to avoid collisions.
                    switch (err instanceof MatrixError ? err.errcode : err) {
                        case "M_FORBIDDEN":
                            throw new MatrixError({ errcode: "M_PROFILE_UNDISCLOSED" });
                        case "M_NOT_FOUND":
                            throw new MatrixError({ errcode: "M_USER_NOT_FOUND" });
                        default:
                            throw err;
                    }
                }
            }

            const opts: InviteOpts = {};
            if (this.reason !== undefined) opts.reason = this.reason;
            if (SettingsStore.getValue("feature_share_history_on_invite")) opts.shareEncryptedHistory = true;

            return this.matrixClient.invite(roomId, addr, opts);
        } else {
            throw new Error("Unsupported address");
        }
    }

    /**
     * Attempt to invite a user.
     *
     * Does not normally throw exceptions. If there was an error, this is reflected in {@link errors}.
     * If the error was fatal and should prevent further invites from being done, {@link _fatal} is set.
     */
    private doInvite(address: string, ignoreProfile: boolean): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            logger.log(`Inviting ${address}`);

            const doInvite = this.inviteToRoom(this.roomId, address, ignoreProfile);
            doInvite
                .then(() => {
                    this.completionStates[address] = InviteState.Invited;
                    delete this.errors[address];

                    resolve();
                    this.options.progressCallback?.();
                })
                .catch((err) => {
                    logger.error(err);

                    const room = this.roomId ? this.matrixClient.getRoom(this.roomId) : null;
                    const isSpace = room?.isSpaceRoom();
                    const isFederated = room?.currentState.getStateEvents(EventType.RoomCreate, "")?.getContent()[
                        "m.federate"
                    ];

                    let errorText: string | undefined;
                    switch (err.errcode) {
                        case "M_FORBIDDEN":
                            if (isSpace) {
                                errorText =
                                    isFederated === false
                                        ? _t("invite|error_unfederated_space")
                                        : _t("invite|error_permissions_space");
                            } else {
                                errorText =
                                    isFederated === false
                                        ? _t("invite|error_unfederated_room")
                                        : _t("invite|error_permissions_room");
                            }
                            // No point doing further invites.
                            this._fatal = true;
                            break;
                        case USER_ALREADY_INVITED:
                            if (isSpace) {
                                errorText = _t("invite|error_already_invited_space");
                            } else {
                                errorText = _t("invite|error_already_invited_room");
                            }
                            break;
                        case USER_ALREADY_JOINED:
                            if (isSpace) {
                                errorText = _t("invite|error_already_joined_space");
                            } else {
                                errorText = _t("invite|error_already_joined_room");
                            }
                            break;
                        case "M_LIMIT_EXCEEDED":
                            // we're being throttled so wait a bit & try again
                            window.setTimeout(() => {
                                this.doInvite(address, ignoreProfile).then(resolve, reject);
                            }, 5000);
                            return;
                        case "M_NOT_FOUND":
                        case "M_USER_NOT_FOUND":
                            errorText = _t("invite|error_user_not_found");
                            break;
                        case "M_PROFILE_UNDISCLOSED":
                            errorText = _t("invite|error_profile_undisclosed");
                            break;
                        case "M_PROFILE_NOT_FOUND":
                            if (!ignoreProfile) {
                                // Invite without the profile check
                                logger.warn(`User ${address} does not have a profile - inviting anyways automatically`);
                                this.doInvite(address, true).then(resolve, reject);
                                return;
                            }
                            break;
                        case "M_BAD_STATE":
                        case USER_BANNED:
                            errorText = _t("invite|error_bad_state");
                            break;
                        case "M_UNSUPPORTED_ROOM_VERSION":
                            if (isSpace) {
                                errorText = _t("invite|error_version_unsupported_space");
                            } else {
                                errorText = _t("invite|error_version_unsupported_room");
                            }
                            break;
                        case "ORG.MATRIX.JSSDK_MISSING_PARAM":
                            if (getAddressType(address) === AddressType.Email) {
                                errorText = _t("cannot_invite_without_identity_server");
                            }
                    }

                    if (!errorText) {
                        errorText = _t("invite|error_unknown");
                    }

                    this.completionStates[address] = InviteState.Error;
                    this.errors[address] = { errorText, errcode: err.errcode };

                    resolve();
                });
        });
    }

    /** Handle users which failed with an error code which indicated that their profile was unknown.
     *
     * Depending on the `promptBeforeInviteUnknownUsers` setting, we either prompt the user for how to proceed, or
     * send the invites anyway.
     */
    private handleUnknownProfileUsers(unknownProfileUsers: string[]): Promise<void> {
        return new Promise<void>((resolve) => {
            const inviteUnknowns = (): void => {
                const promises = unknownProfileUsers.map((u) => this.doInvite(u, true));
                Promise.all(promises).then(() => resolve());
            };

            if (!SettingsStore.getValue("promptBeforeInviteUnknownUsers", this.roomId)) {
                inviteUnknowns();
                return;
            }

            logger.log("Showing failed to invite dialog...");
            Modal.createDialog(AskInviteAnywayDialog, {
                unknownProfileUsers: unknownProfileUsers.map((u) => ({
                    userId: u,
                    errorText: this.errors[u].errorText,
                })),
                onInviteAnyways: () => inviteUnknowns(),
                onGiveUp: () => {
                    // Fake all the completion states because we already warned the user
                    for (const addr of unknownProfileUsers) {
                        this.completionStates[addr] = InviteState.Invited;
                    }
                    resolve();
                },
            });
        });
    }
}
