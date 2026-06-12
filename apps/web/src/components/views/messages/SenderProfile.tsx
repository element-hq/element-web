/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useEffect } from "react";
import { type MatrixEvent, MsgType, type RoomMember } from "matrix-js-sdk/src/matrix";
import { useCreateAutoDisposedViewModel, DisambiguatedProfileView } from "@element-hq/web-shared-components";

import { DisambiguatedProfileViewModel } from "../../../viewmodels/room/timeline/event-tile/DisambiguatedProfileViewModel";
import { useRoomMemberProfile } from "../../../hooks/room/useRoomMemberProfile";
import { useUserStatus } from "../../../hooks/useUserStatus";

interface PureProps {
    senderId?: string;
    member?: RoomMember | null;
    isEmote: boolean;
    onClick?(this: void): void;
    withTooltip?: boolean;
}

interface LegacyProps {
    mxEvent: MatrixEvent;
    onClick?(this: void): void;
    withTooltip?: boolean;
}

type IProps = PureProps | LegacyProps;

export default function SenderProfile(props: IProps): JSX.Element {
    const senderId = "mxEvent" in props ? props.mxEvent.getSender() : props.senderId;
    const resolvedMember = useRoomMemberProfile({
        userId: senderId,
        member: "mxEvent" in props ? props.mxEvent.sender : props.member,
    });
    const userStatus = useUserStatus(senderId);
    const isEmote = "mxEvent" in props ? props.mxEvent.getContent().msgtype === MsgType.Emote : props.isEmote;
    const onClick = props.onClick;
    const withTooltip = props.withTooltip;

    const disambiguatedProfileVM = useCreateAutoDisposedViewModel(
        () =>
            new DisambiguatedProfileViewModel({
                fallbackName: senderId ?? "",
                onClick,
                member: resolvedMember,
                colored: true,
                emphasizeDisplayName: true,
                withTooltip,
                userStatus,
            }),
    );

    useEffect(() => {
        disambiguatedProfileVM.setUserStatus(userStatus);
    }, [disambiguatedProfileVM, userStatus]);
    useEffect(() => {
        disambiguatedProfileVM.setMember(senderId ?? "", resolvedMember);
    }, [disambiguatedProfileVM, resolvedMember, senderId]);
    return !isEmote ? (
        <DisambiguatedProfileView vm={disambiguatedProfileVM} className="mx_DisambiguatedProfile" />
    ) : (
        <></>
    );
}
