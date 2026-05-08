/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import type { RoomMember } from "matrix-js-sdk/src/matrix";
import { AvatarSize } from "../../../../models/rooms/EventTileModel";
import MemberAvatar from "../../avatars/MemberAvatar";

type AvatarProps = Readonly<{
    member?: RoomMember | null;
    size: AvatarSize;
    viewUserOnClick: boolean;
    forceHistorical: boolean;
}>;

const avatarSizeByMode: Record<Exclude<AvatarSize, AvatarSize.None>, string> = {
    [AvatarSize.XSmall]: "14px",
    [AvatarSize.Small]: "20px",
    [AvatarSize.Medium]: "24px",
    [AvatarSize.Large]: "30px",
    [AvatarSize.XLarge]: "32px",
};

export function Avatar({ member, size, viewUserOnClick, forceHistorical }: AvatarProps): JSX.Element | undefined {
    if (!member || size === AvatarSize.None) return undefined;

    const pixelSize = avatarSizeByMode[size];

    return (
        <div className="mx_EventTile_avatar">
            <MemberAvatar
                member={member}
                size={pixelSize}
                viewUserOnClick={viewUserOnClick}
                forceHistorical={forceHistorical}
            />
        </div>
    );
}
