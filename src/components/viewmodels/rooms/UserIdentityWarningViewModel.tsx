/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { EventType, MatrixEvent, Room, RoomStateEvent, RoomMember } from "matrix-js-sdk/src/matrix";
import { CryptoEvent, CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { throttle } from "lodash";
import { logger } from "matrix-js-sdk/src/logger";

import { useMatrixClientContext } from "../../../contexts/MatrixClientContext.tsx";
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter.ts";
import { ButtonEvent } from "../../views/elements/AccessibleButton.tsx";

export type ViolationType = "PinViolation" | "VerificationViolation";

export type ViolationPrompt = {
    member: RoomMember;
    type: ViolationType;
};

export interface UserIdentityWarningState {
    currentPrompt?: ViolationPrompt;
    onButtonClick: (ev: ButtonEvent) => void;
}

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
    const onRoomStateEvent = useCallback(
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
    );
    useTypedEventEmitter(cli, RoomStateEvent.Events, onRoomStateEvent);

    // We need to listen for changes to the verification status of the members to refresh violations
    const onUserVerificationStatusChanged = useCallback(
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
    );
    useTypedEventEmitter(cli, CryptoEvent.UserTrustStatusChanged, onUserVerificationStatusChanged);

    useEffect(() => {
        loadViolations().catch((e) => {
            logger.error("Error initialising UserIdentityWarning:", e);
        });
    }, [loadViolations]);

    let onButtonClick: (ev: ButtonEvent) => void = () => {};
    if (currentPrompt) {
        onButtonClick = (ev: ButtonEvent): void => {
            // XXX do we want some posthog tracking?
            if (!crypto) {
                return;
            }
            ev.preventDefault();
            if (currentPrompt.type === "VerificationViolation") {
                crypto.withdrawVerificationRequirement(currentPrompt.member.userId).catch((e) => {
                    logger.error("Error withdrawing verification requirement:", e);
                });
            } else if (currentPrompt.type === "PinViolation") {
                crypto.pinCurrentUserIdentity(currentPrompt.member.userId).catch((e) => {
                    logger.error("Error withdrawing verification requirement:", e);
                });
            }
        };
    }

    return {
        currentPrompt,
        onButtonClick,
    };
}
