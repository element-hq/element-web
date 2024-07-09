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
import { Room } from "matrix-js-sdk/src/matrix";
import { Text } from "@vector-im/compound-web";

import RoomAvatar from "../avatars/RoomAvatar";
import { useRoomName } from "../../../hooks/useRoomName";

/**
 * Returns a space scope header if needed
 * @param room The room object
 * @returns rendered component if the room is a space room, otherwise returns null
 */
export function createSpaceScopeHeader(room?: Room | null): React.JSX.Element | null {
    if (room?.isSpaceRoom()) return <SpaceScopeHeader room={room} />;
    else return null;
}

/**
 * Scope header used to decorate right panels that are scoped to a space.
 * It renders room avatar and name.
 */
export const SpaceScopeHeader: React.FC<{ room: Room }> = ({ room }) => {
    const roomName = useRoomName(room);

    return (
        <Text
            as="div"
            size="lg"
            weight="semibold"
            className="mx_SpaceScopeHeader"
            title={roomName}
            data-testid="space-header"
        >
            <RoomAvatar room={room} size="32px" />
            {roomName}
        </Text>
    );
};
