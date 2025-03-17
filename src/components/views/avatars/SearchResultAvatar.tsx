/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type RoomMember } from "matrix-js-sdk/src/matrix";

import emailPillAvatar from "../../../../res/img/icon-email-pill-avatar.svg";
import { mediaFromMxc } from "../../../customisations/Media";
import { type Member, type ThreepidMember } from "../../../utils/direct-messages";
import BaseAvatar from "./BaseAvatar";

interface SearchResultAvatarProps {
    user: Member | RoomMember;
    size: string;
}

export function SearchResultAvatar({ user, size }: SearchResultAvatarProps): JSX.Element {
    if ((user as ThreepidMember).isEmail) {
        // we can’t show a real avatar here, but we try to create the exact same markup that a real avatar would have
        // BaseAvatar makes the avatar, if it's not clickable but just for decoration, invisible to screenreaders by
        // specifically setting an empty alt text, so we do the same.
        return (
            <img
                className="mx_SearchResultAvatar mx_SearchResultAvatar_threepidAvatar"
                alt=""
                src={emailPillAvatar}
                width={size}
                height={size}
            />
        );
    } else {
        const avatarUrl = user.getMxcAvatarUrl();
        return (
            <BaseAvatar
                className="mx_SearchResultAvatar"
                url={avatarUrl ? mediaFromMxc(avatarUrl).getSquareThumbnailHttp(parseInt(size, 10)) : null}
                name={user.name}
                idName={user.userId}
                size={size}
            />
        );
    }
}
