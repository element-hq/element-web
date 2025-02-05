/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { EventType, type MatrixEvent, type Room, type RoomMember, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { type CryptoApi, CryptoEvent } from "matrix-js-sdk/src/crypto-api";
import { throttle } from "lodash";
import { logger } from "matrix-js-sdk/src/logger";

import { useMatrixClientContext } from "../../../contexts/MatrixClientContext.tsx";
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter.ts";

export type ViolationType = "PinViolation" | "VerificationViolation";

/**
 * Represents a prompt to the user about a violation in the room.
 * The type of violation and the member it relates to are included.
 * If the type is "VerificationViolation", the warning is critical and should be reported with more urgency.
 */
export type ViolationPrompt = {
    member: RoomMember;
    type: ViolationType;
};

/**
 * The state of the UserIdentityWarningViewModel.
 * This includes the current prompt to show to the user and a callback to handle button clicks.
 * If currentPrompt is undefined, there are no violations to show.
 */
export interface UserIdentityWarningState {
    currentPrompt?: ViolationPrompt;
    dispatchAction: (action: UserIdentityWarningViewModelAction) => void;
}

/**
 * List of actions that can be dispatched to the UserIdentityWarningViewModel.
 */
export type UserIdentityWarningViewModelAction =
    | { type: "PinUserIdentity"; userId: string }
    | { type: "WithdrawVerification"; userId: string };

/**
 * Maps a list of room members to a list of violations.
 * Checks for all members in the room to see if they have any violations.
 * If no violations are found, an empty list is returned.
 *
 * @param cryptoApi
 * @param members - The list of room members to check for violations.
 */
async function mapToViolations(cryptoApi: CryptoApi, members: RoomMember[]): Promise<ViolationPrompt[]> {
    const violationList = new Array<ViolationPrompt>();
    for (const member of members) {
        const verificationStatus = await cryptoApi.getUserVerificationStatus(member.userId);
        if (verificationStatus.wasCrossSigningVerified() && !verificationStatus.isCrossSigningVerified()) {
            violationList.push({ member, type: "VerificationViolation" });
        } else if (verificationStatus.needsUserApproval) {
            violationList.push({ member, type: "PinViolation" });
        }
    }
    return violationList;
}

export function useUserIdentityWarningViewModel(room: Room, key: string): UserIdentityWarningState {
    const cli = useMatrixClientContext();
    const crypto = cli.getCrypto();

    const [members, setMembers] = useState<RoomMember[]>([]);
    const [currentPrompt, setCurrentPrompt] = useState<ViolationPrompt | undefined>(undefined);

    const loadViolations = useMemo(
        () =>
            throttle(async (): Promise<void> => {
                const isEncrypted = crypto && (await crypto.isEncryptionEnabledInRoom(room.roomId));
                if (!isEncrypted) {
                    setMembers([]);
                    setCurrentPrompt(undefined);
                    return;
                }

                const targetMembers = await room.getEncryptionTargetMembers();
                setMembers(targetMembers);
                const violations = await mapToViolations(crypto, targetMembers);

                let candidatePrompt: ViolationPrompt | undefined;
                if (violations.length > 0) {
                    // sort by user ID to ensure consistent ordering
                    const sortedViolations = violations.sort((a, b) => a.member.userId.localeCompare(b.member.userId));
                    candidatePrompt = sortedViolations[0];
                } else {
                    candidatePrompt = undefined;
                }

                // is the current prompt still valid?
                setCurrentPrompt((existingPrompt): ViolationPrompt | undefined => {
                    if (existingPrompt && violations.includes(existingPrompt)) {
                        return existingPrompt;
                    } else if (candidatePrompt) {
                        return candidatePrompt;
                    } else {
                        return undefined;
                    }
                });
            }),
        [crypto, room],
    );

    // We need to listen for changes to the members list
    useTypedEventEmitter(
        cli,
        RoomStateEvent.Events,
        useCallback(
            async (event: MatrixEvent): Promise<void> => {
                if (!crypto || event.getRoomId() !== room.roomId) {
                    return;
                }
                let shouldRefresh = false;

                const eventType = event.getType();

                if (eventType === EventType.RoomEncryption && event.getStateKey() === "") {
                    // Room is now encrypted, so we can initialise the component.
                    shouldRefresh = true;
                } else if (eventType == EventType.RoomMember) {
                    // We're processing an m.room.member event
                    // Something has changed in membership, someone joined or someone left or
                    // someone changed their display name. Anyhow let's refresh.
                    const userId = event.getStateKey();
                    shouldRefresh = !!userId;
                }

                if (shouldRefresh) {
                    loadViolations().catch((e) => {
                        logger.error("Error refreshing UserIdentityWarningViewModel:", e);
                    });
                }
            },
            [crypto, room, loadViolations],
        ),
    );

    // We need to listen for changes to the verification status of the members to refresh violations
    useTypedEventEmitter(
        cli,
        CryptoEvent.UserTrustStatusChanged,
        useCallback(
            (userId: string): void => {
                if (members.find((m) => m.userId == userId)) {
                    // This member is tracked, we need to refresh.
                    // refresh all for now?
                    // As a later optimisation we could store the current violations and only update the relevant one.
                    loadViolations().catch((e) => {
                        logger.error("Error refreshing UserIdentityWarning:", e);
                    });
                }
            },
            [loadViolations, members],
        ),
    );

    useEffect(() => {
        loadViolations().catch((e) => {
            logger.error("Error initialising UserIdentityWarning:", e);
        });
    }, [loadViolations]);

    const dispatchAction = useCallback(
        (action: UserIdentityWarningViewModelAction): void => {
            if (!crypto) {
                return;
            }
            if (action.type === "PinUserIdentity") {
                crypto.pinCurrentUserIdentity(action.userId).catch((e) => {
                    logger.error("Error pinning user identity:", e);
                });
            } else if (action.type === "WithdrawVerification") {
                crypto.withdrawVerificationRequirement(action.userId).catch((e) => {
                    logger.error("Error withdrawing verification requirement:", e);
                });
            }
        },
        [crypto],
    );

    return {
        currentPrompt,
        dispatchAction,
    };
}
