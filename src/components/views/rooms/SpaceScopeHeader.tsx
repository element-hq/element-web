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
 * Scope header used to decorate right panels that are scoped to a space.
 * When room is not a space renders nothing.
 * Otherwise renders room avatar and name.
 */
export const SpaceScopeHeader: React.FC<{ room: Room }> = ({ room }) => {
    const roomName = useRoomName(room);

    if (!room.isSpaceRoom()) {
        return null;
    }

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
