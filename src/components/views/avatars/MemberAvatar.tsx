/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2022 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, forwardRef, type ReactNode, type Ref, useContext } from "react";
import { type RoomMember, type ResizeMethod } from "matrix-js-sdk/src/matrix";

import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import BaseAvatar from "./BaseAvatar";
import { mediaFromMxc } from "../../../customisations/Media";
import { CardContext } from "../right_panel/context";
import UserIdentifierCustomisations from "../../../customisations/UserIdentifier";
import { useRoomMemberProfile } from "../../../hooks/room/useRoomMemberProfile";
import { _t } from "../../../languageHandler";
import MatrixClientContext from "../../../contexts/MatrixClientContext.tsx";

interface IProps extends Omit<React.ComponentProps<typeof BaseAvatar>, "name" | "idName" | "url"> {
    member: RoomMember | null;
    fallbackUserId?: string;
    size: string;
    resizeMethod?: ResizeMethod;
    // Whether the onClick of the avatar should be overridden to dispatch `Action.ViewUser`
    viewUserOnClick?: boolean;
    pushUserOnClick?: boolean;
    title?: string;
    style?: any;
    forceHistorical?: boolean; // true to deny `useOnlyCurrentProfiles` usage. Default false.
    hideTitle?: boolean;
    children?: ReactNode;
}

function MemberAvatar(
    {
        size,
        resizeMethod = "crop",
        viewUserOnClick,
        forceHistorical,
        fallbackUserId,
        hideTitle,
        member: propsMember,
        ...props
    }: IProps,
    ref: Ref<HTMLElement>,
): JSX.Element {
    const cli = useContext(MatrixClientContext);
    const card = useContext(CardContext);

    const member = useRoomMemberProfile({
        userId: propsMember?.userId,
        member: propsMember,
        forceHistorical: forceHistorical,
    });

    const name = member?.name ?? fallbackUserId;
    let title: string | undefined = props.title;
    let imageUrl: string | null | undefined;
    if (member?.name) {
        if (member.getMxcAvatarUrl()) {
            imageUrl = mediaFromMxc(member.getMxcAvatarUrl() ?? "", cli).getThumbnailOfSourceHttp(
                parseInt(size, 10),
                parseInt(size, 10),
                resizeMethod,
            );
        }

        if (!title) {
            title =
                UserIdentifierCustomisations.getDisplayUserIdentifier(member?.userId ?? "", {
                    roomId: member?.roomId ?? "",
                }) ?? fallbackUserId;
        }
    }

    return (
        <BaseAvatar
            {...props}
            size={size}
            name={name ?? ""}
            title={hideTitle ? undefined : title}
            idName={member?.userId ?? fallbackUserId}
            url={imageUrl}
            onClick={
                viewUserOnClick
                    ? () => {
                          dis.dispatch({
                              action: Action.ViewUser,
                              member: propsMember,
                              push: card.isCard,
                          });
                      }
                    : props.onClick
            }
            altText={_t("common|user_avatar")}
            ref={ref}
        />
    );
}

export default forwardRef(MemberAvatar);
