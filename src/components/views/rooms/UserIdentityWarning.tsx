/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useRef, useState } from "react";
import { EventType, KnownMembership, MatrixEvent, Room, RoomStateEvent, RoomMember } from "matrix-js-sdk/src/matrix";
import { CryptoApi, CryptoEvent, UserVerificationStatus } from "matrix-js-sdk/src/crypto-api";
import { logger } from "matrix-js-sdk/src/logger";
import { Button, Separator } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";
import MemberAvatar from "../avatars/MemberAvatar";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";

interface UserIdentityWarningProps {
    /**
     * The current room being viewed.
     */
    room: Room;
    /**
     * The ID of the room being viewed.  This is used to ensure that the
     * component's state and references are cleared when the room changes.
     */
    key: string;
}

/**
 * Does the given user's identity need to be approved?
 */
async function userNeedsApproval(crypto: CryptoApi, userId: string): Promise<boolean> {
    const verificationStatus = await crypto.getUserVerificationStatus(userId);
    return verificationStatus.needsUserApproval;
}

/**
 * Whether the component is uninitialised, is in the process of initialising, or
 * has completed initialising.
 */
enum InitialisationStatus {
    Uninitialised,
    Initialising,
    Completed,
}

/**
 * Displays a banner warning when there is an issue with a user's identity.
 *
 * Warns when an unverified user's identity has changed, and gives the user a
 * button to acknowledge the change.
 */
export const UserIdentityWarning: React.FC<UserIdentityWarningProps> = ({ room }) => {
    const cli = useMatrixClientContext();
    const crypto = cli.getCrypto();

    // The current room member that we are prompting the user to approve.
    // `undefined` means we are not currently showing a prompt.
    const [currentPrompt, setCurrentPrompt] = useState<RoomMember | undefined>(undefined);

    // Whether or not we've already initialised the component by loading the
    // room membership.
    const initialisedRef = useRef<InitialisationStatus>(InitialisationStatus.Uninitialised);
    // Which room members need their identity approved.
    const membersNeedingApprovalRef = useRef<Map<string, RoomMember>>(new Map());
    // Whether we got a verification status update while we were fetching a
    // user's verification status.
    //
    // We set the entry for a user to `false` when we start fetching a user's
    // verification status, and remove the user's entry when we are done
    // fetching.  When we receive a verification status update, if the entry for
    // the user is `false`, we set it to `true`.  After we have finished
    // fetching the user's verification status, if the entry for the user is
    // `true`, rather than `false`, we know that we got an update, and so we
    // discard the value that we fetched.  We always use the value from the
    // update and consider it as the most up-to-date version.  If the fetched
    // value is more up-to-date, then we should be getting a new update soon
    // with the newer value, so it will fix itself in the end.
    const gotVerificationStatusUpdateRef = useRef<Map<string, boolean>>(new Map());

    // Select a new user to display a warning for.  This is called after the
    // current prompted user no longer needs their identity approved.
    const selectCurrentPrompt = useCallback((): RoomMember | undefined => {
        const membersNeedingApproval = membersNeedingApprovalRef.current;
        if (membersNeedingApproval.size === 0) {
            return undefined;
        }

        // We pick the user with the smallest user ID.
        const keys = Array.from(membersNeedingApproval.keys()).sort((a, b) => a.localeCompare(b));
        const selection = membersNeedingApproval.get(keys[0]!);
        return selection;
    }, []);

    // Add a user to the membersNeedingApproval map, and update the current
    // prompt if necessary. The user will only be added if they are actually a
    // member of the room. If they are not a member, this function will do
    // nothing.
    const addMemberNeedingApproval = useCallback(
        (userId: string, member?: RoomMember): void => {
            if (userId === cli.getUserId()) {
                // We always skip our own user, because we can't pin our own identity.
                return;
            }
            member = member ?? room.getMember(userId) ?? undefined;
            if (member) {
                membersNeedingApprovalRef.current.set(userId, member);
                // We only select the prompt if we are done initialising,
                // because we will select the prompt after we're done
                // initialising, and we want to start by displaying a warning
                // for the user with the smallest ID.
                if (initialisedRef.current === InitialisationStatus.Completed) {
                    setCurrentPrompt((currentPrompt) => {
                        // If we aren't currently displaying a warning, we pick
                        // a new user to show a warning for.  If we are already
                        // displaying a warning, don't change the display.
                        //
                        // We have to do this in a callback to
                        // `setCurrentPrompt` because this function could have
                        // been called after an `await`, and the `currentPrompt`
                        // that this function would have may be outdated.
                        if (!currentPrompt) {
                            return selectCurrentPrompt();
                        } else {
                            return currentPrompt;
                        }
                    });
                }
            }
        },
        [cli, room, selectCurrentPrompt],
    );

    // Check if the user's identity needs approval, and if so, add them to the
    // membersNeedingApproval map and update the prompt if needed. They will
    // only be added if they are a member of the room.
    const addMemberIfNeedsApproval = useCallback(
        async (userId: string, member?: RoomMember): Promise<void> => {
            const gotVerificationStatusUpdate = gotVerificationStatusUpdateRef.current;
            const membersNeedingApproval = membersNeedingApprovalRef.current;

            if (gotVerificationStatusUpdate.has(userId)) {
                // We're already checking their verification status, so we don't
                // need to do anything here.
                return;
            }
            gotVerificationStatusUpdate.set(userId, false);
            if (await userNeedsApproval(crypto!, userId)) {
                if (!membersNeedingApproval.has(userId) && gotVerificationStatusUpdate.get(userId) === false) {
                    addMemberNeedingApproval(userId, member);
                }
            }
            gotVerificationStatusUpdate.delete(userId);
        },
        [crypto, addMemberNeedingApproval],
    );

    // Remove a user from the membersNeedingApproval map, and update the current
    // prompt if necessary.
    const removeMemberNeedingApproval = useCallback(
        (userId: string): void => {
            membersNeedingApprovalRef.current.delete(userId);

            // If we removed the currently displayed user, we need to pick a new one
            // to display.
            if (currentPrompt?.userId === userId) {
                setCurrentPrompt(selectCurrentPrompt());
            }
        },
        [currentPrompt, selectCurrentPrompt],
    );

    // Initialise the component.  Get the room members, check which ones need
    // their identity approved, and pick one to display.
    const loadMembers = useCallback(async (): Promise<void> => {
        if (!crypto || initialisedRef.current != InitialisationStatus.Uninitialised) {
            return;
        }
        // If encryption is not enabled in the room, we don't need to do
        // anything.  If encryption gets enabled later, we will retry, via
        // onRoomStateEvent.
        if (!(await crypto.isEncryptionEnabledInRoom(room.roomId))) {
            return;
        }
        initialisedRef.current = InitialisationStatus.Initialising;

        const members = await room.getEncryptionTargetMembers();

        for (const member of members) {
            await addMemberIfNeedsApproval(member.userId, member);
        }

        setCurrentPrompt(selectCurrentPrompt());
        initialisedRef.current = InitialisationStatus.Completed;
    }, [crypto, room, addMemberIfNeedsApproval, selectCurrentPrompt]);

    loadMembers().catch((e) => {
        logger.error("Error initialising UserIdentityWarning:", e);
    });

    // When a user's verification status changes, we check if they need to be
    // added/removed from the set of members needing approval.
    const onUserVerificationStatusChanged = useCallback(
        (userId: string, verificationStatus: UserVerificationStatus): void => {
            const gotVerificationStatusUpdate = gotVerificationStatusUpdateRef.current;

            // If we haven't started initialising, that means that we're in a
            // room where we don't need to display any warnings.
            if (initialisedRef.current === InitialisationStatus.Uninitialised) {
                return;
            }

            if (gotVerificationStatusUpdate.has(userId)) {
                gotVerificationStatusUpdate.set(userId, true);
            }

            if (verificationStatus.needsUserApproval) {
                addMemberNeedingApproval(userId);
            } else {
                removeMemberNeedingApproval(userId);
            }
        },
        [addMemberNeedingApproval, removeMemberNeedingApproval],
    );
    useTypedEventEmitter(cli, CryptoEvent.UserTrustStatusChanged, onUserVerificationStatusChanged);

    // We watch for encryption events (since we only display warnings in
    // encrypted rooms), and for membership changes (since we only display
    // warnings for users in the room).
    const onRoomStateEvent = useCallback(
        async (event: MatrixEvent): Promise<void> => {
            if (!crypto || event.getRoomId() !== room.roomId) {
                return;
            }

            const eventType = event.getType();
            if (eventType === EventType.RoomEncryption && event.getStateKey() === "") {
                // Room is now encrypted, so we can initialise the component.
                return loadMembers().catch((e) => {
                    logger.error("Error initialising UserIdentityWarning:", e);
                });
            } else if (eventType !== EventType.RoomMember) {
                return;
            }

            if (initialisedRef.current === InitialisationStatus.Uninitialised) {
                return;
            }

            const userId = event.getStateKey();

            if (!userId) return;

            if (
                event.getContent().membership === KnownMembership.Join ||
                (event.getContent().membership === KnownMembership.Invite && room.shouldEncryptForInvitedMembers())
            ) {
                // Someone's membership changed and we will now encrypt to them.  If
                // their identity needs approval, show a warning.
                await addMemberIfNeedsApproval(userId);
            } else {
                // Someone's membership changed and we no longer encrypt to them.
                // If we're showing a warning about them, we don't need to any more.
                removeMemberNeedingApproval(userId);
            }
        },
        [crypto, room, addMemberIfNeedsApproval, removeMemberNeedingApproval, loadMembers],
    );
    useTypedEventEmitter(cli, RoomStateEvent.Events, onRoomStateEvent);

    if (!crypto || !currentPrompt) return null;

    const confirmIdentity = async (): Promise<void> => {
        await crypto.pinCurrentUserIdentity(currentPrompt.userId);
    };

    return (
        <div className="mx_UserIdentityWarning">
            <Separator />
            <div className="mx_UserIdentityWarning_row">
                <MemberAvatar member={currentPrompt} title={currentPrompt.userId} size="30px" />
                <span className="mx_UserIdentityWarning_main">
                    {currentPrompt.rawDisplayName === currentPrompt.userId
                        ? _t(
                              "encryption|pinned_identity_changed_no_displayname",
                              { userId: currentPrompt.userId },
                              {
                                  a: substituteATag,
                                  b: substituteBTag,
                              },
                          )
                        : _t(
                              "encryption|pinned_identity_changed",
                              { displayName: currentPrompt.rawDisplayName, userId: currentPrompt.userId },
                              {
                                  a: substituteATag,
                                  b: substituteBTag,
                              },
                          )}
                </span>
                <Button kind="primary" size="sm" onClick={confirmIdentity}>
                    {_t("action|ok")}
                </Button>
            </div>
        </div>
    );
};

function substituteATag(sub: string): React.ReactNode {
    return (
        <a href="https://element.io/help#encryption18" target="_blank" rel="noreferrer noopener">
            {sub}
        </a>
    );
}

function substituteBTag(sub: string): React.ReactNode {
    return <b>{sub}</b>;
}
