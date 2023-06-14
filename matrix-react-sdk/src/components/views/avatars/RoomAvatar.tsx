/*
Copyright 2015, 2016 OpenMarket Ltd

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

import React, { ComponentProps } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import classNames from "classnames";
import { EventType, RoomType } from "matrix-js-sdk/src/@types/event";

import BaseAvatar from "./BaseAvatar";
import ImageView from "../elements/ImageView";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Modal from "../../../Modal";
import * as Avatar from "../../../Avatar";
import DMRoomMap from "../../../utils/DMRoomMap";
import { mediaFromMxc } from "../../../customisations/Media";
import { IOOBData } from "../../../stores/ThreepidInviteStore";
import { LocalRoom } from "../../../models/LocalRoom";
import { filterBoolean } from "../../../utils/arrays";

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

export default class RoomAvatar extends React.Component<IProps, IState> {
    public static defaultProps = {
        width: 36,
        height: 36,
        resizeMethod: "crop",
        oobData: {},
    };

    public constructor(props: IProps) {
        super(props);

        this.state = {
            urls: RoomAvatar.getImageUrls(this.props),
        };
    }

    public componentDidMount(): void {
        MatrixClientPeg.get().on(RoomStateEvent.Events, this.onRoomStateEvents);
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
        let oobAvatar: string | null = null;
        if (props.oobData.avatarUrl) {
            oobAvatar = mediaFromMxc(props.oobData.avatarUrl).getThumbnailOfSourceHttp(
                props.width,
                props.height,
                props.resizeMethod,
            );
        }

        return filterBoolean([
            oobAvatar, // highest priority
            RoomAvatar.getRoomAvatarUrl(props),
        ]);
    }

    private static getRoomAvatarUrl(props: IProps): string | null {
        if (!props.room) return null;

        return Avatar.avatarUrlForRoom(props.room, props.width, props.height, props.resizeMethod);
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
            const dmMapUserId = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
            // If the room is a DM, we use the other user's ID for the color hash
            // in order to match the room avatar with their avatar
            if (dmMapUserId) return dmMapUserId;

            if (room instanceof LocalRoom && room.targets.length === 1) {
                return room.targets[0].userId;
            }
        }

        return this.props.room?.roomId || this.props.oobData?.roomId;
    }

    public render(): React.ReactNode {
        const { room, oobData, viewAvatarOnClick, onClick, className, ...otherProps } = this.props;
        const roomName = room?.name ?? oobData.name ?? "?";

        return (
            <BaseAvatar
                {...otherProps}
                className={classNames(className, {
                    mx_RoomAvatar_isSpaceRoom: (room?.getType() ?? this.props.oobData?.roomType) === RoomType.Space,
                })}
                name={roomName}
                idName={this.roomIdName}
                urls={this.state.urls}
                onClick={viewAvatarOnClick && this.state.urls[0] ? this.onRoomAvatarClick : onClick}
            />
        );
    }
}
