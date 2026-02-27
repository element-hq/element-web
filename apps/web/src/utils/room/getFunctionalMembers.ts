/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room, UNSTABLE_ELEMENT_FUNCTIONAL_USERS } from "matrix-js-sdk/src/matrix";

export const getFunctionalMembers = (room: Room): string[] => {
    const [functionalUsersStateEvent] = room.currentState.getStateEvents(UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name);

    if (Array.isArray(functionalUsersStateEvent?.getContent().service_members)) {
        return functionalUsersStateEvent.getContent().service_members;
    }

    return [];
};
