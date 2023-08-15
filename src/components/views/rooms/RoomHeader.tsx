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
import { Body as BodyText } from "@vector-im/compound-web";

import type { Room } from "matrix-js-sdk/src/matrix";
import { useRoomName } from "../../../hooks/useRoomName";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { useTopic } from "../../../hooks/room/useTopic";
import { Flex } from "../../utils/Flex";
import { Box } from "../../utils/Box";

export default function RoomHeader({ room }: { room: Room }): JSX.Element {
    const roomName = useRoomName(room);
    const roomTopic = useTopic(room);

    return (
        <Flex
            as="header"
            align="center"
            gap="var(--cpd-space-3x)"
            className="mx_RoomHeader light-panel"
            onClick={() => {
                const rightPanel = RightPanelStore.instance;
                rightPanel.isOpen
                    ? rightPanel.togglePanel(null)
                    : rightPanel.setCard({ phase: RightPanelPhases.RoomSummary });
            }}
        >
            <DecoratedRoomAvatar room={room} avatarSize={40} displayBadge={false} />
            <Box flex="1" className="mx_RoomHeader_info">
                <BodyText
                    as="div"
                    size="lg"
                    weight="semibold"
                    dir="auto"
                    title={roomName}
                    role="heading"
                    aria-level={1}
                >
                    {roomName}
                </BodyText>
                {roomTopic && (
                    <BodyText as="div" size="sm" className="mx_RoomHeader_topic">
                        {roomTopic.text}
                    </BodyText>
                )}
            </Box>
        </Flex>
    );
}
