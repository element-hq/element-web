import { IPublicRoomsChunkRoom, Room } from "matrix-js-sdk/src/matrix";
import { getDisplayAliasForAliasSet } from "matrix-react-sdk/src/Rooms";
import { _t } from "matrix-react-sdk/src/languageHandler";
import { IOOBData } from "matrix-react-sdk/src/stores/ThreepidInviteStore";
import { useMemo } from "react";

/**
 * Removes the [TG] prefix and leading whitespace from a room name
 * @param roomName
 * @returns {string}
 */
export function getSafeRoomName(roomName?: string): string {
    return roomName?.replace(/^(\s|\[TG\])*/, "") || "";
}

/**
 * Determines the room name from a combination of the room model and potential
 * @param room - The room model
 * @param oobData - out-of-band information about the room
 * @returns {string} the room name
 */
export function getRoomName(room?: Room | IPublicRoomsChunkRoom, oobName?: IOOBData): string {
    const roomName =
        room?.name ||
        oobName?.name ||
        getDisplayAliasForAliasSet(
            (room as IPublicRoomsChunkRoom)?.canonical_alias ?? "",
            (room as IPublicRoomsChunkRoom)?.aliases ?? [],
        ) ||
        _t("common|unnamed_room");

    return getSafeRoomName(
        (roomName || "").replace(":", ":\u200b"), // add a zero-width space to allow linewrapping after the colon (matrix defaults)
    );
}

/**
 * Determines if a room is a token gated room
 * @param room - The room model
 * @returns {boolean} true if the room is token gated
 */
export function isTokenGatedRoom(room?: Room | IPublicRoomsChunkRoom): boolean {
    return !!room?.name?.includes("[TG]");
}

/**
 * Determines the room name from a combination of the room model and potential
 * out-of-band information
 * @param room - The room model
 * @param oobData - out-of-band information about the room
 * @returns {string} the room name
 *
 * TODO: check if useTypedEventEmitter is needed
 */
export function useRoomName(room?: Room | IPublicRoomsChunkRoom, oobData?: IOOBData): string {
    const name = useMemo(() => {
        return getRoomName(room, oobData);
    }, [room, oobData]);

    return name;
}
