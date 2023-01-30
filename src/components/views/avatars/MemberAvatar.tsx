/*
Copyright 2015, 2016, 2019 - 2023 The Matrix.org Foundation C.I.C.

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

import React, { useContext } from "react";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { ResizeMethod } from "matrix-js-sdk/src/@types/partials";

import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import BaseAvatar from "./BaseAvatar";
import { mediaFromMxc } from "../../../customisations/Media";
import { CardContext } from "../right_panel/context";
import UserIdentifierCustomisations from "../../../customisations/UserIdentifier";
import { useRoomMemberProfile } from "../../../hooks/room/useRoomMemberProfile";
import { ViewUserPayload } from "../../../dispatcher/payloads/ViewUserPayload";

interface IProps extends Omit<React.ComponentProps<typeof BaseAvatar>, "name" | "idName" | "url"> {
    member: RoomMember | null;
    fallbackUserId?: string;
    width: number;
    height: number;
    resizeMethod?: ResizeMethod;
    /** Whether the onClick of the avatar should be overridden to dispatch `Action.ViewUser` */
    viewUserOnClick?: boolean;
    pushUserOnClick?: boolean;
    title?: string;
    style?: React.CSSProperties;
    /** true to deny `useOnlyCurrentProfiles` usage. Default false. */
    forceHistorical?: boolean;
    hideTitle?: boolean;
}

export default function MemberAvatar({
    width,
    height,
    resizeMethod = "crop",
    viewUserOnClick,
    forceHistorical,
    fallbackUserId,
    hideTitle,
    member: propsMember,
    ...props
}: IProps): JSX.Element {
    const card = useContext(CardContext);

    const member = useRoomMemberProfile({
        userId: propsMember?.userId,
        member: propsMember,
        forceHistorical: forceHistorical,
    });

    const name = member?.name ?? fallbackUserId;
    let title: string | undefined = props.title;
    let imageUrl: string | undefined;
    if (member?.name) {
        if (member.getMxcAvatarUrl()) {
            imageUrl = mediaFromMxc(member.getMxcAvatarUrl() ?? "").getThumbnailOfSourceHttp(
                width,
                height,
                resizeMethod,
            );
        }

        if (!title) {
            title =
                UserIdentifierCustomisations.getDisplayUserIdentifier!(member.userId, {
                    roomId: member.roomId,
                }) ?? fallbackUserId;
        }
    }

    return (
        <BaseAvatar
            {...props}
            width={width}
            height={height}
            name={name ?? ""}
            title={hideTitle ? undefined : title}
            idName={member?.userId ?? fallbackUserId}
            url={imageUrl}
            onClick={
                viewUserOnClick
                    ? () => {
                          dis.dispatch<ViewUserPayload>({
                              action: Action.ViewUser,
                              member: propsMember || undefined,
                              push: card.isCard,
                          });
                      }
                    : props.onClick
            }
        />
    );
}

export class LegacyMemberAvatar extends React.Component<IProps> {
    public render(): JSX.Element {
        return <MemberAvatar {...this.props}>{this.props.children}</MemberAvatar>;
    }
}
