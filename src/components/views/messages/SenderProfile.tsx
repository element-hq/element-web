/*
 Copyright 2023 The Matrix.org Foundation C.I.C.
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

import React from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { MsgType } from "matrix-js-sdk/src/@types/event";

import DisambiguatedProfile from "./DisambiguatedProfile";
import { useRoomMemberProfile } from "../../../hooks/room/useRoomMemberProfile";

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

    return mxEvent.getContent().msgtype !== MsgType.Emote ? (
        <DisambiguatedProfile
            fallbackName={mxEvent.getSender() ?? ""}
            onClick={onClick}
            member={member}
            colored={true}
            emphasizeDisplayName={true}
            withTooltip={withTooltip}
        />
    ) : (
        <></>
    );
}
