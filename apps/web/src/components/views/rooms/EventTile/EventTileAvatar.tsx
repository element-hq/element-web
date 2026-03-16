/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import type { RoomMember } from "matrix-js-sdk/src/matrix";
import MemberAvatar from "../../avatars/MemberAvatar";

export function EventTileAvatar({
    member,
    size,
    viewUserOnClick,
    forceHistorical,
}: {
    member?: RoomMember | null;
    size?: string | null;
    viewUserOnClick: boolean;
    forceHistorical: boolean;
}): JSX.Element | undefined {
    if (!member || size === null || size === undefined) return undefined;

    return (
        <div className="mx_EventTile_avatar">
            <MemberAvatar
                member={member}
                size={size}
                viewUserOnClick={viewUserOnClick}
                forceHistorical={forceHistorical}
            />
        </div>
    );
}
