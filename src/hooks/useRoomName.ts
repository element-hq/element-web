import { IPublicRoomsChunkRoom, Room } from "matrix-js-sdk/src/matrix";
import { getDisplayAliasForAliasSet } from "matrix-react-sdk/src/Rooms";
import { _t } from "matrix-react-sdk/src/languageHandler";
import { IOOBData } from "matrix-react-sdk/src/stores/ThreepidInviteStore";

/**
 * Removes the [TG] prefix and leading whitespace from a room name
 * @param roomName
 * @returns {string}
 */
export function getSafeRoomName(roomName?: string): string {
    return roomName?.replace(/^(\s|\[TG\])*/, "").replace(/^(\s|\$)*/, "") || "";
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
