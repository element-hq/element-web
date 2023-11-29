import { Room } from "matrix-js-sdk/src/matrix";
import { useMemo } from "react";

export function getRoomName(room?: Room): string {
    return (room?.name || "")
        .replace(":", ":\u200b") // add a zero-width space to allow linewrapping after the colon (matrix defaults)
        .replace("[TG]", "");
}

export function isTokenGatedRoom(room: Room): boolean {
    return room?.name?.includes("[TG]");
}

export function useTokenGatedRoom(room: Room): { roomName: string; isVerifiedRoom: boolean } {
    const roomName = useMemo(() => {
        return getRoomName(room);
    }, [room]);

    const isVerifiedRoom = useMemo(() => {
        return isTokenGatedRoom(room);
    }, [room]);

    return {
        roomName,
        isVerifiedRoom,
    };
}
