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
import React from 'react';
import Room from 'matrix-js-sdk/src/models/room';
import {getHttpUriForMxc} from 'matrix-js-sdk/src/content-repo';

import BaseAvatar from './BaseAvatar';
import ImageView from '../elements/ImageView';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import Modal from '../../../Modal';
import * as Avatar from '../../../Avatar';

interface IProps {
    // Room may be left unset here, but if it is,
    // oobData.avatarUrl should be set (else there
    // would be nowhere to get the avatar from)
    room?: Room;
    // TODO: type when js-sdk has types
    oobData?: any;
    width?: number;
    height?: number;
    resizeMethod?: string;
    viewAvatarOnClick?: boolean;
}

interface IState {
    urls: string[];
}

export default class RoomAvatar extends React.Component<IProps, IState> {
    public static defaultProps = {
        width: 36,
        height: 36,
        resizeMethod: 'crop',
        oobData: {},
    };

    constructor(props: IProps) {
        super(props);

        this.state = {
            urls: RoomAvatar.getImageUrls(this.props),
        };
    }

    public componentDidMount() {
        MatrixClientPeg.get().on("RoomState.events", this.onRoomStateEvents);
    }

    public componentWillUnmount() {
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener("RoomState.events", this.onRoomStateEvents);
        }
    }

    public static getDerivedStateFromProps(nextProps: IProps): IState {
        return {
            urls: RoomAvatar.getImageUrls(nextProps),
        };
    }

    // TODO: type when js-sdk has types
    private onRoomStateEvents = (ev: any) => {
        if (!this.props.room ||
            ev.getRoomId() !== this.props.room.roomId ||
            ev.getType() !== 'm.room.avatar'
        ) return;

        this.setState({
            urls: RoomAvatar.getImageUrls(this.props),
        });
    };

    private static getImageUrls(props: IProps): string[] {
        return [
            getHttpUriForMxc(
                MatrixClientPeg.get().getHomeserverUrl(),
                // Default props don't play nicely with getDerivedStateFromProps
                //props.oobData !== undefined ? props.oobData.avatarUrl : {},
                props.oobData.avatarUrl,
                Math.floor(props.width * window.devicePixelRatio),
                Math.floor(props.height * window.devicePixelRatio),
                props.resizeMethod,
            ), // highest priority
            RoomAvatar.getRoomAvatarUrl(props),
        ].filter(function(url) {
            return (url !== null && url !== "");
        });
    }

    private static getRoomAvatarUrl(props: IProps): string {
        if (!props.room) return null;

        return Avatar.avatarUrlForRoom(
            props.room,
            Math.floor(props.width * window.devicePixelRatio),
            Math.floor(props.height * window.devicePixelRatio),
            props.resizeMethod,
        );
    }

    private onRoomAvatarClick = () => {
        const avatarUrl = this.props.room.getAvatarUrl(
            MatrixClientPeg.get().getHomeserverUrl(),
            null, null, null, false);
        const params = {
            src: avatarUrl,
            name: this.props.room.name,
        };

        Modal.createDialog(ImageView, params, "mx_Dialog_lightbox");
    };

    public render() {
        const {room, oobData, viewAvatarOnClick, ...otherProps} = this.props;

        const roomName = room ? room.name : oobData.name;

        return (
            <BaseAvatar {...otherProps}
                name={roomName}
                idName={room ? room.roomId : null}
                urls={this.state.urls}
                onClick={viewAvatarOnClick && this.state.urls[0] ? this.onRoomAvatarClick : null}
            />
        );
    }
}
