import { IPublicRoomsChunkRoom, Room } from "matrix-js-sdk/src/matrix";
import { useMemo } from "react";

/**
 * Custom hook to check if a room is verified
 * @param room - The room model
 */
export function useVerifiedRoom(room?: Room | IPublicRoomsChunkRoom): {
    isTokenGatedRoom: boolean;
    isCommunityRoom: boolean;
} {
    const isTokenGatedRoom = useMemo<boolean>(() => {
        return !!room?.name?.startsWith("[TG]");
    }, [room]);

    const isCommunityRoom = useMemo(() => {
        return !!room?.name?.startsWith("$");
    }, [room]);

    return {
        isTokenGatedRoom,
        isCommunityRoom,
    };
}
