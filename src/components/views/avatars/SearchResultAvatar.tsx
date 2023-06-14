/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { RoomMember } from "matrix-js-sdk/src/matrix";

import emailPillAvatar from "../../../../res/img/icon-email-pill-avatar.svg";
import { mediaFromMxc } from "../../../customisations/Media";
import { Member, ThreepidMember } from "../../../utils/direct-messages";
import BaseAvatar from "./BaseAvatar";

interface SearchResultAvatarProps {
    user: Member | RoomMember;
    size: number;
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
                url={avatarUrl ? mediaFromMxc(avatarUrl).getSquareThumbnailHttp(size) : null}
                name={user.name}
                idName={user.userId}
                width={size}
                height={size}
            />
        );
    }
}
