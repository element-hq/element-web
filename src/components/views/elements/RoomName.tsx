/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { IPublicRoomsChunkRoom, Room } from "matrix-js-sdk/src/matrix";
import React, { useCallback, useMemo } from "react";

import { Icon as TokenGatedRoomIcon } from "../../../../res/themes/superhero/img/icons/tokengated-room.svg";
import { Icon as CommunityRoomIcon } from "../../../../res/themes/superhero/img/icons/community-room.svg";
import { getRoomName } from "../../../hooks/useRoomName";
import { useVerifiedRoom } from "../../../hooks/useVerifiedRoom";
import { UserVerifiedBadge } from "./UserVerifiedBadge";
import { BotVerifiedBadge } from "./BotVerifiedBadge";

interface IProps {
    room?: Room | IPublicRoomsChunkRoom;
    children?(name: JSX.Element): JSX.Element;
    maxLength?: number;
}

export const RoomName = ({ room, children, maxLength }: IProps): JSX.Element => {
    const roomName = getRoomName(room);
    const { isTokenGatedRoom, isCommunityRoom } = useVerifiedRoom(room);

    const roomUser: string | undefined = useMemo(() => {
        // check if this is a DM room and if so, return the other user's ID
        const dmUserId = (room as Room)?.guessDMUserId?.();

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // need to access the private summaryHeroes property, to know if it's a DM room
        if (!(room as Room)?.summaryHeroes) {
            return undefined;
        }

        return dmUserId && dmUserId !== (room as Room).myUserId ? dmUserId : undefined;
    }, [room]);

    const truncatedRoomName = useMemo(() => {
        if (maxLength && roomName.length > maxLength) {
            return `${roomName.substring(0, maxLength)}...`;
        }
        return roomName;
    }, [roomName, maxLength]);

    const renderRoomName = useCallback(
        () => (
            <span className="sh_RoomTokenGatedRoom">
                {isCommunityRoom && (
                    <>
                        <CommunityRoomIcon className="sh_RoomTokenGatedRoomIcon" />
                        <span>$</span>
                    </>
                )}
                {isTokenGatedRoom && <TokenGatedRoomIcon className="sh_RoomTokenGatedRoomIcon" />}
                <span dir="auto">{truncatedRoomName}</span>
                {roomUser && !isTokenGatedRoom && !isCommunityRoom ? <UserVerifiedBadge userId={roomUser} /> : null}
                {roomUser && !isTokenGatedRoom && !isCommunityRoom ? <BotVerifiedBadge userId={roomUser} /> : null}
            </span>
        ),
        [truncatedRoomName, isCommunityRoom, isTokenGatedRoom, roomUser],
    );

    if (children) return children(renderRoomName());
    return renderRoomName();
};

export default RoomName;
