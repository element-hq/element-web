/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React, { MouseEventHandler } from "react";
import { RoomMember } from "matrix-js-sdk/src/matrix";

import { LiveBadge } from "../..";
import MemberAvatar from "../../../components/views/avatars/MemberAvatar";

interface VoiceBroadcastRecordingBodyProps {
    live: boolean;
    member: RoomMember;
    onClick: MouseEventHandler<HTMLDivElement>;
    title: string;
    userId: string;
}

export const VoiceBroadcastRecordingBody: React.FC<VoiceBroadcastRecordingBodyProps> = ({
    live,
    member,
    onClick,
    title,
    userId,
}) => {
    const liveBadge = live
        ? <LiveBadge />
        : null;

    return (
        <div
            className="mx_VoiceBroadcastRecordingBody"
            onClick={onClick}
        >
            <MemberAvatar member={member} fallbackUserId={userId} />
            <div className="mx_VoiceBroadcastRecordingBody_content">
                <div className="mx_VoiceBroadcastRecordingBody_title">
                    { title }
                </div>
            </div>
            { liveBadge }
        </div>
    );
};
