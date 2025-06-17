/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room, KnownMembership } from "matrix-js-sdk/src/matrix";

import type { Filter } from ".";
import { FilterKey } from ".";

export class InvitesFilter implements Filter {
    public matches(room: Room): boolean {
        return room.getMyMembership() === KnownMembership.Invite;
    }

    public get key(): FilterKey.InvitesFilter {
        return FilterKey.InvitesFilter;
    }
}
