/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { EventType, type MatrixEvent, type Room, type RoomMember, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { type CryptoApi, CryptoEvent } from "matrix-js-sdk/src/crypto-api";
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

/**
 * Finds the violation to prompt the user about, if any.
 * Violations are ordered by user ID so the same one is picked each time while it remains.
 *
 * @param cryptoApi - The crypto API, if crypto is enabled.
 * @param room - The room to check.
 */
async function findViolationToPrompt(
    cryptoApi: CryptoApi | undefined,
    room: Room,
): Promise<ViolationPrompt | undefined> {
    if (!cryptoApi || !(await cryptoApi.isEncryptionEnabledInRoom(room.roomId))) return undefined;

    const violations = await mapToViolations(cryptoApi, await room.getEncryptionTargetMembers());
    violations.sort((a, b) => a.member.userId.localeCompare(b.member.userId));
    return violations[0];
}

/**
 * Loads the prompt to show, one load at a time. A refresh requested while a load is running queues one more load,
 * so a burst of events costs at most two loads and the last one sees the latest state.
 */
class PromptLoader {
    private running = false;
    private loading = false;
    private reloadRequested = false;

    public constructor(
        private readonly cryptoApi: CryptoApi | undefined,
        private readonly room: Room,
        private readonly onPrompt: (prompt: ViolationPrompt | undefined) => void,
    ) {}

    /** Start reporting prompts, and load the current one. */
    public start(): void {
        this.running = true;
        this.refresh();
    }

    /** Stop reporting prompts. A load which is in progress finishes, but its result is dropped. */
    public stop(): void {
        this.running = false;
    }

    /** Load the prompt again, as something it depends on has changed. */
    public refresh(): void {
        if (this.loading) {
            this.reloadRequested = true;
        } else {
            void this.load();
        }
    }

    private async load(): Promise<void> {
        this.loading = true;
        do {
            this.reloadRequested = false;
            try {
                const prompt = await findViolationToPrompt(this.cryptoApi, this.room);
                // If a reload was requested meanwhile, that load reports the prompt instead
                if (this.running && !this.reloadRequested) this.onPrompt(prompt);
            } catch (e) {
                logger.error("Error loading UserIdentityWarning:", e);
            }
        } while (this.reloadRequested && this.running);
        this.loading = false;
    }
}

export function useUserIdentityWarningViewModel(room: Room): UserIdentityWarningState {
    const cli = useMatrixClientContext();
    const crypto = cli.getCrypto();

    const [currentPrompt, setCurrentPrompt] = useState<ViolationPrompt | undefined>(undefined);

    const loader = useMemo(() => new PromptLoader(crypto, room, setCurrentPrompt), [crypto, room]);
    useEffect(() => {
        loader.start();
        return () => loader.stop();
    }, [loader]);

    // Membership changes, or the room becoming encrypted, change who we need to warn about
    useTypedEventEmitter(cli, RoomStateEvent.Events, (event: MatrixEvent): void => {
        if (event.getRoomId() !== room.roomId) return;

        const eventType = event.getType();
        const isEncryptionEnabled = eventType === EventType.RoomEncryption && event.getStateKey() === "";
        const isMembershipChange = eventType === EventType.RoomMember && !!event.getStateKey();
        if (isEncryptionEnabled || isMembershipChange) loader.refresh();
    });

    // A change in a member's verification status can add or clear their violation
    useTypedEventEmitter(cli, CryptoEvent.UserTrustStatusChanged, (userId: string): void => {
        if (room.getMember(userId)) loader.refresh();
    });

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
