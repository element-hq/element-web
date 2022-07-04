/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.

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
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { ResizeMethod } from 'matrix-js-sdk/src/@types/partials';
import { logger } from "matrix-js-sdk/src/logger";

import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import BaseAvatar from "./BaseAvatar";
import { mediaFromMxc } from "../../../customisations/Media";
import { CardContext } from '../right_panel/context';
import UserIdentifierCustomisations from '../../../customisations/UserIdentifier';
import SettingsStore from "../../../settings/SettingsStore";
import { MatrixClientPeg } from "../../../MatrixClientPeg";

interface IProps extends Omit<React.ComponentProps<typeof BaseAvatar>, "name" | "idName" | "url"> {
    member: RoomMember | null;
    fallbackUserId?: string;
    width: number;
    height: number;
    resizeMethod?: ResizeMethod;
    // The onClick to give the avatar
    onClick?: React.MouseEventHandler;
    // Whether the onClick of the avatar should be overridden to dispatch `Action.ViewUser`
    viewUserOnClick?: boolean;
    pushUserOnClick?: boolean;
    title?: string;
    style?: any;
    forceHistorical?: boolean; // true to deny `useOnlyCurrentProfiles` usage. Default false.
    hideTitle?: boolean;
}

interface IState {
    name: string;
    title: string;
    imageUrl?: string;
}

export default class MemberAvatar extends React.PureComponent<IProps, IState> {
    public static defaultProps = {
        width: 40,
        height: 40,
        resizeMethod: 'crop',
        viewUserOnClick: false,
    };

    constructor(props: IProps) {
        super(props);

        this.state = MemberAvatar.getState(props);
    }

    public static getDerivedStateFromProps(nextProps: IProps): IState {
        return MemberAvatar.getState(nextProps);
    }

    private static getState(props: IProps): IState {
        let member = props.member;
        if (member && !props.forceHistorical && SettingsStore.getValue("useOnlyCurrentProfiles")) {
            const room = MatrixClientPeg.get().getRoom(member.roomId);
            if (room) {
                member = room.getMember(member.userId);
            }
        }
        if (member?.name) {
            let imageUrl = null;
            const userTitle = UserIdentifierCustomisations.getDisplayUserIdentifier(
                member.userId, { roomId: member?.roomId },
            );
            if (member.getMxcAvatarUrl()) {
                imageUrl = mediaFromMxc(member.getMxcAvatarUrl()).getThumbnailOfSourceHttp(
                    props.width,
                    props.height,
                    props.resizeMethod,
                );
            }
            return {
                name: member.name,
                title: props.title || userTitle,
                imageUrl: imageUrl,
            };
        } else if (props.fallbackUserId) {
            return {
                name: props.fallbackUserId,
                title: props.fallbackUserId,
            };
        } else {
            logger.error("MemberAvatar called somehow with null member or fallbackUserId");
            return {} as IState; // prevent an explosion
        }
    }

    render() {
        let {
            member,
            fallbackUserId,
            onClick,
            viewUserOnClick,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            forceHistorical,
            hideTitle,
            ...otherProps
        } = this.props;
        const userId = member ? member.userId : fallbackUserId;

        if (viewUserOnClick) {
            onClick = () => {
                dis.dispatch({
                    action: Action.ViewUser,
                    member: this.props.member,
                    push: this.context.isCard,
                });
            };
        }

        return (
            <BaseAvatar
                {...otherProps}
                name={this.state.name}
                title={hideTitle ? undefined : this.state.title}
                idName={userId}
                url={this.state.imageUrl}
                onClick={onClick}
            />
        );
    }
}

MemberAvatar.contextType = CardContext;
