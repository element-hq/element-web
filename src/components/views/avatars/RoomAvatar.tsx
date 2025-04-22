/*
Copyright 2024, 2025 New Vector Ltd.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useMemo, type ComponentProps } from "react";
import { type Room, RoomType, KnownMembership, EventType } from "matrix-js-sdk/src/matrix";
import { type RoomAvatarEventContent } from "matrix-js-sdk/src/types";

import BaseAvatar from "./BaseAvatar";
import ImageView from "../elements/ImageView";
import Modal from "../../../Modal";
import * as Avatar from "../../../Avatar";
import { mediaFromMxc } from "../../../customisations/Media";
import { type IOOBData } from "../../../stores/ThreepidInviteStore";
import { filterBoolean } from "../../../utils/arrays";
import { useSettingValue } from "../../../hooks/useSettings";
import { useRoomState } from "../../../hooks/useRoomState";
import { useRoomIdName } from "../../../hooks/room/useRoomIdName";
import { MediaPreviewValue } from "../../../@types/media_preview";

interface IProps extends Omit<ComponentProps<typeof BaseAvatar>, "name" | "idName" | "url" | "onClick" | "size"> {
    // Room may be left unset here, but if it is,
    // oobData.avatarUrl should be set (else there
    // would be nowhere to get the avatar from)
    room?: Room;
    // Optional here.
    size?: ComponentProps<typeof BaseAvatar>["size"];
    oobData?: IOOBData & {
        roomId?: string;
    };
    viewAvatarOnClick?: boolean;
    onClick?(): void;
}

const RoomAvatar: React.FC<IProps> = ({ room, viewAvatarOnClick, onClick, oobData, size = "36px", ...otherProps }) => {
    const roomName = room?.name ?? oobData?.name ?? "?";
    const avatarEvent = useRoomState(room, (state) => state.getStateEvents(EventType.RoomAvatar, ""));
    const roomIdName = useRoomIdName(room, oobData);

    const showAvatarsOnInvites =
        useSettingValue("mediaPreviewConfig", room?.roomId).invite_avatars === MediaPreviewValue.On;

    const onRoomAvatarClick = useCallback(() => {
        const avatarUrl = Avatar.avatarUrlForRoom(room ?? null);
        if (!avatarUrl) return;
        const params = {
            src: avatarUrl,
            name: room?.name,
        };

        Modal.createDialog(ImageView, params, "mx_Dialog_lightbox", undefined, true);
    }, [room]);

    const urls = useMemo(() => {
        const myMembership = room?.getMyMembership();
        if (!showAvatarsOnInvites && (myMembership === KnownMembership.Invite || !myMembership)) {
            // The user has opted out of showing avatars, so return no urls here.
            return [];
        }

        // parseInt ignores suffixes.
        const sizeInt = parseInt(size, 10);
        let oobAvatar: string | null = null;
        if (oobData?.avatarUrl) {
            oobAvatar = mediaFromMxc(oobData?.avatarUrl).getThumbnailOfSourceHttp(sizeInt, sizeInt, "crop");
        }

        return filterBoolean([
            oobAvatar, // highest priority
            Avatar.avatarUrlForRoom(
                room ?? null,
                sizeInt,
                sizeInt,
                "crop",
                avatarEvent?.getContent<RoomAvatarEventContent>().url,
            ),
        ]);
    }, [showAvatarsOnInvites, room, size, avatarEvent, oobData]);

    return (
        <BaseAvatar
            {...otherProps}
            size={size}
            type={(room?.getType() ?? oobData?.roomType) === RoomType.Space ? "square" : "round"}
            name={roomName}
            idName={roomIdName}
            urls={urls}
            onClick={viewAvatarOnClick && urls[0] ? onRoomAvatarClick : onClick}
        />
    );
};

export default RoomAvatar;
