import React from "react";
import { Room } from "matrix-js-sdk/src/matrix";

import { Icon as TokenGatedRoomIcon } from "../../../../res/themes/superhero/img/icons/tokengated-room.svg";
import { useTokenGatedRoom } from "../../../hooks/useTokengatedRoom";

export interface CustomRoomNameProps {
    room: Room;
}
export const CustomRoomName: React.FC<CustomRoomNameProps> = ({ room }) => {
    const { roomName, isVerifiedRoom } = useTokenGatedRoom(room);
    return (
        <>
            {isVerifiedRoom && <TokenGatedRoomIcon className="sh_RoomTokenGatedRoomIcon" />}
            <span dir="auto">{roomName}</span>
        </>
    );
};
