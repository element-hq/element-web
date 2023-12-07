import { IPublicRoomsChunkRoom, Room } from "matrix-js-sdk/src/matrix";
import { useMemo } from "react";

/**
 * Determines if a room is a token gated room
 * @param room - The room model
 * @returns {boolean} true if the room is token gated
 */
export function isTokenGatedRoom(room?: Room | IPublicRoomsChunkRoom): boolean {
    return !!room?.name?.startsWith("[TG]");
}

/**
 * Custom hook to check if a room is verified
 * @param room - The room model
 * @returns {boolean} true if the room is verified, false otherwise
 */
export function useVerifiedRoom(room?: Room | IPublicRoomsChunkRoom): boolean {
    const isVerifiedRoom = useMemo(() => {
        return isTokenGatedRoom(room);
    }, [room]);

    return isVerifiedRoom;
}
