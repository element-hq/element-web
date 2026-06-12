/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useEffect } from "react";
import { useCreateAutoDisposedViewModel, DisambiguatedProfileView } from "@element-hq/web-shared-components";

import {
    DisambiguatedProfileViewModel,
    type MemberInfo,
} from "../../../viewmodels/room/timeline/event-tile/DisambiguatedProfileViewModel";
import { useUserStatus } from "../../../hooks/useUserStatus";

interface IProps {
    /** Stable sender ID for the profile. */
    senderId?: string;
    /** Plain member data used to resolve display name, identifier, and tooltip state. */
    member?: MemberInfo | null;
    /** Whether the message body renders as an emote. */
    isEmote: boolean;
    /** Invoked when the profile is clicked. */
    onClick?(this: void): void;
    /** Whether to show the disambiguation tooltip. */
    withTooltip?: boolean;
}

/**
 * Renders the sender identity for message and timeline views from pure render data.
 */
export default function SenderProfile(props: IProps): JSX.Element {
    const senderId = props.senderId ?? props.member?.userId;
    const member = props.member;
    const userStatus = useUserStatus(senderId);
    const isEmote = props.isEmote;
    const onClick = props.onClick;
    const withTooltip = props.withTooltip;

    const disambiguatedProfileVM = useCreateAutoDisposedViewModel(
        () =>
            new DisambiguatedProfileViewModel({
                fallbackName: senderId ?? "",
                onClick,
                member,
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
        disambiguatedProfileVM.setMember(senderId ?? "", member);
    }, [disambiguatedProfileVM, member, senderId]);

    return isEmote ? (
        <></>
    ) : (
        <DisambiguatedProfileView vm={disambiguatedProfileVM} className="mx_DisambiguatedProfile" />
    );
}
