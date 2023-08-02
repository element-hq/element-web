/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import type { Room } from "matrix-js-sdk/src/models/room";
import { IOOBData } from "../../../stores/ThreepidInviteStore";
import { useRoomName } from "../../../hooks/useRoomName";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { useTopic } from "../../../hooks/room/useTopic";
import RoomAvatar from "../avatars/RoomAvatar";

export default function RoomHeader({ room, oobData }: { room?: Room; oobData?: IOOBData }): JSX.Element {
    const roomName = useRoomName(room, oobData);
    const roomTopic = useTopic(room);

    return (
        <header
            className="mx_RoomHeader light-panel"
            onClick={() => {
                const rightPanel = RightPanelStore.instance;
                rightPanel.isOpen
                    ? rightPanel.togglePanel(null)
                    : rightPanel.setCard({ phase: RightPanelPhases.RoomSummary });
            }}
        >
            {room ? (
                <DecoratedRoomAvatar room={room} oobData={oobData} avatarSize={40} displayBadge={false} />
            ) : (
                <RoomAvatar oobData={oobData} width={40} height={40} />
            )}
            <div className="mx_RoomHeader_info">
                <div dir="auto" title={roomName} role="heading" aria-level={1} className="mx_RoomHeader_name">
                    {roomName}
                </div>
                {roomTopic && <div className="mx_RoomHeader_topic">{roomTopic.text}</div>}
            </div>
        </header>
    );
}
