/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import DisambiguatedProfile from "./DisambiguatedProfile";
import { useRoomMemberProfile } from "../../../hooks/room/useRoomMemberProfile";
import ModuleApi from "../../../modules/Api";
import { CustomComponentsApi } from "../../../modules/customComponentApi";
import { MessageProfileComponentProps } from "@element-hq/element-web-module-api";
interface IProps {
    mxEvent: MatrixEvent;
    onClick?(): void;
    withTooltip?: boolean;
}

export default function SenderProfile({ mxEvent, onClick, withTooltip }: IProps): JSX.Element {
    const member = useRoomMemberProfile({
        userId: mxEvent.getSender(),
        member: mxEvent.sender,
    });
    
    if (mxEvent.getContent().msgtype === MsgType.Emote) {
        return <></>;
    }
    const moduleRenderer = ModuleApi.customComponents.messageProfileRenderer;
    const renderFn = (moduleProps: MessageProfileComponentProps) => <DisambiguatedProfile
        fallbackName={moduleProps.mxEvent.sender ?? ""}
        onClick={moduleProps.onClick}
        member={moduleProps.member}
        colored={true}
        emphasizeDisplayName={true}
        withTooltip={withTooltip}
    />;

    const modProps = {
        onClick,
        mxEvent: CustomComponentsApi.getModuleMatrixEvent(mxEvent)!,
        member: member || undefined,
    };

    return moduleRenderer ? moduleRenderer(modProps, renderFn) : renderFn(modProps);
}
