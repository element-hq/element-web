/*
Copyright 2024, 2025 New Vector Ltd.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useMemo, type ComponentProps } from "react";
import { type Room, RoomType, KnownMembership } from "matrix-js-sdk/src/matrix";

import BaseAvatar from "./BaseAvatar";
import ImageView from "../elements/ImageView";
import Modal from "../../../Modal";
import * as Avatar from "../../../Avatar";
import DMRoomMap from "../../../utils/DMRoomMap";
import { mediaFromMxc } from "../../../customisations/Media";
import { type IOOBData } from "../../../stores/ThreepidInviteStore";
import { LocalRoom } from "../../../models/LocalRoom";
import { filterBoolean } from "../../../utils/arrays";
import { MediaPreviewValue } from "../../../@types/media_preview";
import { useRoomAvatar } from "../../../hooks/room/useRoomAvatar";
import { useSettingValue } from "../../../hooks/useSettings";

interface IProps extends Omit<ComponentProps<typeof BaseAvatar>, "name" | "idName" | "url" | "onClick"> {
    // Room may be left unset here, but if it is,
    // oobData.avatarUrl should be set (else there
    // would be nowhere to get the avatar from)
    room?: Room;
    oobData?: IOOBData & {
        roomId?: string;
    };
    viewAvatarOnClick?: boolean;
    onClick?(): void;
}

export function idNameForRoom(room: Room): string {
    const dmMapUserId = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
    // If the room is a DM, we use the other user's ID for the color hash
    // in order to match the room avatar with their avatar
    if (dmMapUserId) return dmMapUserId;

    if (room instanceof LocalRoom && room.targets.length === 1) {
        return room.targets[0].userId;
    }

    return room.roomId;
}

export const RoomAvatar: React.FC<IProps> = ({
    room,
    viewAvatarOnClick,
    onClick,
    className,
    oobData,
    ...otherProps
}) => {
    const size = otherProps.size ?? "36px";

    const roomName = room?.name ?? oobData?.name ?? "?";
    const roomAvatarMxc = useRoomAvatar(room);
    const roomIdName = useMemo(() => {
        if (room) {
            return idNameForRoom(room);
        } else {
            return oobData?.roomId;
        }
    }, [oobData, room]);

    const mediaPreviewEnabled =
        useSettingValue("mediaPreviewConfig", room?.roomId).invite_avatars === MediaPreviewValue.On;

    const onRoomAvatarClick = useCallback(() => {
        const avatarUrl = Avatar.avatarUrlForRoom(room ?? null, undefined, undefined, undefined);
        if (!avatarUrl) return;
        const params = {
            src: avatarUrl,
            name: room?.name,
        };

        Modal.createDialog(ImageView, params, "mx_Dialog_lightbox", undefined, true);
    }, [room]);

    const urls = useMemo(() => {
        // Apparently parseInt ignores suffixes.
        const sizeInt = parseInt(size, 10);
        const myMembership = room?.getMyMembership();
        if (myMembership === KnownMembership.Invite || !myMembership) {
            if (!mediaPreviewEnabled) {
                // The user has opted out of showing avatars, so return no urls here.
                return [];
            }
        }
        let oobAvatar: string | null = null;
        if (oobData?.avatarUrl) {
            oobAvatar = mediaFromMxc(oobData?.avatarUrl).getThumbnailOfSourceHttp(sizeInt, sizeInt, "crop");
        }

        return filterBoolean([
            oobAvatar, // highest priority
            roomAvatarMxc && Avatar.avatarUrlForRoom(room ?? null, sizeInt, sizeInt, "crop"),
        ]);
    }, [mediaPreviewEnabled, room, size, roomAvatarMxc, oobData]);

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
