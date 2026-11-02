/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { IOOBData } from "../../stores/ThreepidInviteStore";

/**
 * The data used to render the avatar of a preview item in the room list, in place of a js-sdk `Room`.
 */
export class PreviewRoomAvatarData implements IOOBData {
    /**
     * @param roomId The id of the room.
     * @param name The name of the room.
     * @param avatarUrl The mxc:// URL of the room avatar, if any.
     * @param roomType The type of the room, if any.
     */
    public constructor(
        public readonly roomId: string,
        public readonly name: string,
        public readonly avatarUrl?: string,
        public readonly roomType?: string,
    ) {}
}
