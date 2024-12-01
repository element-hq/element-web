/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import React, { forwardRef, Ref } from "react";

import BaseAvatar from "./BaseAvatar";
import { _t } from "../../../languageHandler";
import { RoomMember } from "../../../models/rooms/RoomMember";
import { AvatarThumbnailData, avatarUrl } from "../../../models/rooms/AvatarThumbnailData";

interface Props {
    member: RoomMember;
    size: string;
    resizeMethod?: "crop" | "scale";
}

function MemberAvatarView({ size, resizeMethod = "crop", member }: Props, ref: Ref<HTMLElement>): JSX.Element {
    let imageUrl = undefined;
    const avatarThumbnailUrl = member.avatarThumbnailUrl;

    if (!!avatarThumbnailUrl) {
        const data: AvatarThumbnailData = {
            src: avatarThumbnailUrl,
            width: parseInt(size, 10),
            height: parseInt(size, 10),
            resizeMethod: resizeMethod,
        };
        imageUrl = avatarUrl(data);
    }

    return (
        <BaseAvatar
            size={size}
            name={member.name}
            idName={member.userId}
            title={member.displayUserId}
            url={imageUrl}
            altText={_t("common|user_avatar")}
            ref={ref}
        />
    );
}

export default forwardRef(MemberAvatarView);
