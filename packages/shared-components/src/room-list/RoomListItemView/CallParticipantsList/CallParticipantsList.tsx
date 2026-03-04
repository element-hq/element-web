/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ReactNode, useMemo } from "react";

import { Flex } from "../../../utils/Flex";
import styles from "./CallParticipantsList.module.css";

/**
 * Data representing a participant in a call.
 */
export type CallParticipantListItem = {
    name: string;
    avatarUrl: string | null;
};

/**
 * Data representing the notification state for a room or item.
 * Used in snapshots and passed to the CallParticipantsList component.
 */
export interface CallParticipantsListData {
    participants: CallParticipantListItem[];
    maxIcons: number;
}

/**
 * Props for the CallParticipantsList component.
 */
export interface CallParticipantsListProps extends CallParticipantsListData {
    /** Callback to render a user avatar */
    renderAvatar: (participants: CallParticipantListItem) => ReactNode;
}

export const CallParticipantsList: React.FC<CallParticipantsListProps> = ({ participants, renderAvatar, maxIcons }: CallParticipantsListProps) => {
    const iconOverflow = useMemo(() => {
        const overflowAmount = participants.length - maxIcons;
        if (overflowAmount <= 1) return 0; // Don't show (+1) since it takes a similar amount of space as just showing the 1 extra
        return overflowAmount;
    }, [participants.length, maxIcons]);

    // Don't render anything if there's nothing to show
    if (participants.length === 0) {
        return null;
    }

    return (
        <Flex align="center" justify="end" gap="var(--cpd-space-1x)" data-testid="call-participants-list">
            {participants.slice(0, participants.length - iconOverflow).map((participant) => renderAvatar(participant))}
            {/**/}
            {iconOverflow !== 0 && (
                <div className={styles.additionalUsersIcon}>
                    <span>+{participants.length - iconOverflow}</span>
                </div>
            )}
        </Flex>
    );
};
