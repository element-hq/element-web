/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";

import { RoomListCustomisations } from "../../../customisations/RoomList";
import { isLocalRoom } from "../../../utils/localRoom/isLocalRoom";

export class VisibilityProvider {
    private static internalInstance: VisibilityProvider;

    private constructor() {}

    public static get instance(): VisibilityProvider {
        if (!VisibilityProvider.internalInstance) {
            VisibilityProvider.internalInstance = new VisibilityProvider();
        }
        return VisibilityProvider.internalInstance;
    }

    public isRoomVisible(room?: Room): boolean {
        if (!room) {
            return false;
        }

        // hide space rooms as they'll be shown in the SpacePanel
        if (room.isSpaceRoom()) {
            return false;
        }

        if (isLocalRoom(room)) {
            // local rooms shouldn't show up anywhere
            return false;
        }

        const isVisibleFn = RoomListCustomisations.isRoomVisible;
        if (isVisibleFn) {
            return isVisibleFn(room);
        }

        return true; // default
    }
}
