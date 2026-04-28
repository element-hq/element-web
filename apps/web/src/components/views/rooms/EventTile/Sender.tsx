/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, type JSX } from "react";
import { DisambiguatedProfileView } from "@element-hq/web-shared-components";
import { MsgType, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { useRoomMemberProfile } from "../../../../hooks/room/useRoomMemberProfile";
import { SenderMode } from "../../../../models/rooms/EventTileModel";
import type { DisambiguatedProfileViewModel } from "../../../../viewmodels/room/timeline/event-tile/DisambiguatedProfileViewModel";

type SenderProps = Readonly<{
    mode: SenderMode;
    mxEvent: MatrixEvent;
    onClick?: () => void;
    profileViewModel: DisambiguatedProfileViewModel;
}>;

export function Sender({ mode, mxEvent, onClick, profileViewModel }: SenderProps): JSX.Element | undefined {
    switch (mode) {
        case SenderMode.Hidden:
            return undefined;
        case SenderMode.ComposerInsert:
            return <EventTileSenderProfile mxEvent={mxEvent} onClick={onClick} viewModel={profileViewModel} />;
        case SenderMode.Tooltip:
            return <EventTileSenderProfile mxEvent={mxEvent} withTooltip viewModel={profileViewModel} />;
        default:
            return <EventTileSenderProfile mxEvent={mxEvent} viewModel={profileViewModel} />;
    }
}

type EventTileSenderProfileProps = Readonly<{
    mxEvent: MatrixEvent;
    onClick?: () => void;
    withTooltip?: boolean;
    viewModel: DisambiguatedProfileViewModel;
}>;

function EventTileSenderProfile({
    mxEvent,
    onClick,
    withTooltip,
    viewModel,
}: EventTileSenderProfileProps): JSX.Element {
    const sender = mxEvent.getSender();
    const member = useRoomMemberProfile({
        userId: sender,
        member: mxEvent.sender,
    });

    useEffect(() => {
        viewModel.setProps({
            fallbackName: sender ?? "",
            onClick,
            member,
            colored: true,
            emphasizeDisplayName: true,
            withTooltip,
        });
    }, [member, onClick, sender, viewModel, withTooltip]);

    return mxEvent.getContent().msgtype !== MsgType.Emote ? (
        <DisambiguatedProfileView vm={viewModel} className="mx_DisambiguatedProfile" />
    ) : (
        <></>
    );
}
