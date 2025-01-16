/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useRef, useState } from "react";
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
    // For each user, we assign a sequence number to each verification status
    // that we get, or fetch.
    //
    // Since fetching a verification status is asynchronous, we could get an
    // update in the middle of fetching the verification status, which could
    // mean that the status that we fetched is out of date.  So if the current
    // sequence number is not the same as the sequence number when we started
    // the fetch, then we drop our fetched result, under the assumption that the
    // update that we received is the most up-to-date version.  If it is in fact
    // not the most up-to-date version, then we should be receiving a new update
    // soon with the newer value, so it will fix itself in the end.
    //
    // We also assign a sequence number when the user leaves the room, in order
    // to prevent prompting about a user who leaves while we are fetching their
    // verification status.
    const verificationStatusSequencesRef = useRef<Map<string, number>>(new Map());
    const incrementVerificationStatusSequence = (userId: string): number => {
        const verificationStatusSequences = verificationStatusSequencesRef.current;
        const value = verificationStatusSequences.get(userId);
        const newValue = value === undefined ? 1 : value + 1;
        verificationStatusSequences.set(userId, newValue);
        return newValue;
    };

    // Update the current prompt.  Select a new user if needed, or hide the
    // warning if we don't have anyone to warn about.
    const updateCurrentPrompt = useCallback((): undefined => {
        const membersNeedingApproval = membersNeedingApprovalRef.current;
        // We have to do this in a callback to `setCurrentPrompt`
        // because this function could have been called after an
        // `await`, and the `currentPrompt` that this function would
        // have may be outdated.
        setCurrentPrompt((currentPrompt) => {
            // If we're already displaying a warning, and that user still needs
            // approval, continue showing that user.
            if (currentPrompt && membersNeedingApproval.has(currentPrompt.userId)) return currentPrompt;

            if (membersNeedingApproval.size === 0) {
                if (currentPrompt) {
                    // If we were previously showing a warning, log that we've stopped doing so.
                    logger.debug("UserIdentityWarning: no users left that need approval");
                }
                return undefined;
            }

            // We pick the user with the smallest user ID.
            const keys = Array.from(membersNeedingApproval.keys()).sort((a, b) => a.localeCompare(b));
            const selection = membersNeedingApproval.get(keys[0]!);
            logger.debug(`UserIdentityWarning: now warning about user ${selection?.userId}`);
            return selection;
        });
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
            if (!member) return;

            membersNeedingApprovalRef.current.set(userId, member);
            // We only select the prompt if we are done initialising,
            // because we will select the prompt after we're done
            // initialising, and we want to start by displaying a warning
            // for the user with the smallest ID.
            if (initialisedRef.current === InitialisationStatus.Completed) {
                logger.debug(
                    `UserIdentityWarning: user ${userId} now needs approval; approval-pending list now [${Array.from(membersNeedingApprovalRef.current.keys())}]`,
                );
                updateCurrentPrompt();
            }
        },
        [cli, room, updateCurrentPrompt],
    );

    // For each user in the list check if their identity needs approval, and if
    // so, add them to the membersNeedingApproval map and update the prompt if
    // needed.
    const addMembersWhoNeedApproval = useCallback(
        async (members: RoomMember[]): Promise<void> => {
            const verificationStatusSequences = verificationStatusSequencesRef.current;

            const promises: Promise<void>[] = [];

            for (const member of members) {
                const userId = member.userId;
                const sequenceNum = incrementVerificationStatusSequence(userId);
                promises.push(
                    userNeedsApproval(crypto!, userId).then((needsApproval) => {
                        if (needsApproval) {
                            // Only actually update the list if we have the most
                            // recent value.
                            if (verificationStatusSequences.get(userId) === sequenceNum) {
                                addMemberNeedingApproval(userId, member);
                            }
                        }
                    }),
                );
            }

            await Promise.all(promises);
        },
        [crypto, addMemberNeedingApproval],
    );

    // Remove a user from the membersNeedingApproval map, and update the current
    // prompt if necessary.
    const removeMemberNeedingApproval = useCallback(
        (userId: string): void => {
            membersNeedingApprovalRef.current.delete(userId);
            logger.debug(
                `UserIdentityWarning: user ${userId} no longer needs approval; approval-pending list now [${Array.from(membersNeedingApprovalRef.current.keys())}]`,
            );
            updateCurrentPrompt();
        },
        [updateCurrentPrompt],
    );

    // Initialise the component.  Get the room members, check which ones need
    // their identity approved, and pick one to display.
    const loadMembers = useCallback(async (): Promise<void> => {
        if (!crypto || initialisedRef.current !== InitialisationStatus.Uninitialised) {
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
        await addMembersWhoNeedApproval(members);

        logger.info(
            `Initialised UserIdentityWarning component for room ${room.roomId} with approval-pending list [${Array.from(membersNeedingApprovalRef.current.keys())}]`,
        );
        updateCurrentPrompt();
        initialisedRef.current = InitialisationStatus.Completed;
    }, [crypto, room, addMembersWhoNeedApproval, updateCurrentPrompt]);

    useEffect(() => {
        loadMembers().catch((e) => {
            logger.error("Error initialising UserIdentityWarning:", e);
        });
    }, [loadMembers]);

    // When a user's verification status changes, we check if they need to be
    // added/removed from the set of members needing approval.
    const onUserVerificationStatusChanged = useCallback(
        (userId: string, verificationStatus: UserVerificationStatus): void => {
            // If we haven't started initialising, that means that we're in a
            // room where we don't need to display any warnings.
            if (initialisedRef.current === InitialisationStatus.Uninitialised) {
                return;
            }

            incrementVerificationStatusSequence(userId);

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

            // We're processing an m.room.member event

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
                const member = room.getMember(userId);
                if (member) {
                    await addMembersWhoNeedApproval([member]).catch((e) => {
                        logger.error("Error adding member in UserIdentityWarning:", e);
                    });
                }
            } else {
                // Someone's membership changed and we no longer encrypt to them.
                // If we're showing a warning about them, we don't need to any more.
                removeMemberNeedingApproval(userId);
                incrementVerificationStatusSequence(userId);
            }
        },
        [crypto, room, addMembersWhoNeedApproval, removeMemberNeedingApproval, loadMembers],
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
