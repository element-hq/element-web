/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type PresenceState } from "./PresenceState";

export type RoomMember = {
    roomId: string;
    userId: string;
    displayUserId: string;
    name: string;
    rawDisplayName?: string;
    disambiguate: boolean;
    avatarThumbnailUrl?: string;
    powerLevel: number;
    lastModifiedTime: number;
    presenceState?: PresenceState;
    isInvite: boolean;
};
