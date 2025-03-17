/*
Copyright 2024, 2025 New Vector Ltd.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps } from "react";
import {
    type Room,
    RoomStateEvent,
    type MatrixEvent,
    EventType,
    RoomType,
    KnownMembership,
} from "matrix-js-sdk/src/matrix";

import BaseAvatar from "./BaseAvatar";
import ImageView from "../elements/ImageView";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Modal from "../../../Modal";
import * as Avatar from "../../../Avatar";
import DMRoomMap from "../../../utils/DMRoomMap";
import { mediaFromMxc } from "../../../customisations/Media";
import { type IOOBData } from "../../../stores/ThreepidInviteStore";
import { LocalRoom } from "../../../models/LocalRoom";
import { filterBoolean } from "../../../utils/arrays";
import SettingsStore from "../../../settings/SettingsStore";

interface IProps extends Omit<ComponentProps<typeof BaseAvatar>, "name" | "idName" | "url" | "onClick"> {
    // Room may be left unset here, but if it is,
    // oobData.avatarUrl should be set (else there
    // would be nowhere to get the avatar from)
    room?: Room;
    oobData: IOOBData & {
        roomId?: string;
    };
    viewAvatarOnClick?: boolean;
    onClick?(): void;
}

interface IState {
    urls: string[];
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

export default class RoomAvatar extends React.Component<IProps, IState> {
    public static defaultProps = {
        size: "36px",
        oobData: {},
    };

    public constructor(props: IProps) {
        super(props);

        this.state = {
            urls: RoomAvatar.getImageUrls(this.props),
        };
    }

    public componentDidMount(): void {
        MatrixClientPeg.safeGet().on(RoomStateEvent.Events, this.onRoomStateEvents);
    }

    public componentWillUnmount(): void {
        MatrixClientPeg.get()?.removeListener(RoomStateEvent.Events, this.onRoomStateEvents);
    }

    public static getDerivedStateFromProps(nextProps: IProps): IState {
        return {
            urls: RoomAvatar.getImageUrls(nextProps),
        };
    }

    private onRoomStateEvents = (ev: MatrixEvent): void => {
        if (ev.getRoomId() !== this.props.room?.roomId || ev.getType() !== EventType.RoomAvatar) return;

        this.setState({
            urls: RoomAvatar.getImageUrls(this.props),
        });
    };

    private static getImageUrls(props: IProps): string[] {
        const myMembership = props.room?.getMyMembership();
        if (myMembership === KnownMembership.Invite || !myMembership) {
            if (SettingsStore.getValue("showAvatarsOnInvites") === false) {
                // The user has opted out of showing avatars, so return no urls here.
                return [];
            }
        }
        let oobAvatar: string | null = null;
        if (props.oobData.avatarUrl) {
            oobAvatar = mediaFromMxc(props.oobData.avatarUrl).getThumbnailOfSourceHttp(
                parseInt(props.size, 10),
                parseInt(props.size, 10),
                "crop",
            );
        }

        return filterBoolean([
            oobAvatar, // highest priority
            RoomAvatar.getRoomAvatarUrl(props),
        ]);
    }

    private static getRoomAvatarUrl(props: IProps): string | null {
        if (!props.room) return null;

        return Avatar.avatarUrlForRoom(props.room, parseInt(props.size, 10), parseInt(props.size, 10), "crop");
    }

    private onRoomAvatarClick = (): void => {
        const avatarUrl = Avatar.avatarUrlForRoom(this.props.room ?? null, undefined, undefined, undefined);
        if (!avatarUrl) return;
        const params = {
            src: avatarUrl,
            name: this.props.room?.name,
        };

        Modal.createDialog(ImageView, params, "mx_Dialog_lightbox", undefined, true);
    };

    private get roomIdName(): string | undefined {
        const room = this.props.room;

        if (room) {
            return idNameForRoom(room);
        } else {
            return this.props.oobData?.roomId;
        }
    }

    public render(): React.ReactNode {
        const { room, oobData, viewAvatarOnClick, onClick, className, ...otherProps } = this.props;
        const roomName = room?.name ?? oobData.name ?? "?";

        return (
            <BaseAvatar
                {...otherProps}
                type={(room?.getType() ?? this.props.oobData?.roomType) === RoomType.Space ? "square" : "round"}
                name={roomName}
                idName={this.roomIdName}
                urls={this.state.urls}
                onClick={viewAvatarOnClick && this.state.urls[0] ? this.onRoomAvatarClick : onClick}
            />
        );
    }
}
