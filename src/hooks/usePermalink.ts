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

import { MatrixEvent, Room, RoomMember } from "matrix-js-sdk/src/matrix";

import { ButtonEvent } from "../components/views/elements/AccessibleButton";
import { PillType } from "../components/views/elements/Pill";
import { parsePermalink } from "../utils/permalinks/Permalinks";
import dis from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import { PermalinkParts } from "../utils/permalinks/PermalinkConstructor";
import { _t } from "../languageHandler";
import { usePermalinkTargetRoom } from "./usePermalinkTargetRoom";
import { usePermalinkEvent } from "./usePermalinkEvent";
import { usePermalinkMember } from "./usePermalinkMember";

interface Args {
    /** Room in which the permalink should be displayed. */
    room?: Room;
    /** When set forces the permalink type. */
    type?: PillType;
    /** Permalink URL. */
    url?: string;
}

interface HookResult {
    /**
     * Room member of a user mention permalink.
     * null for other links, if the profile was not found or not yet loaded.
     * This can change, for instance, from null to a RoomMember after the profile lookup completed.
     */
    member: RoomMember | null;
    /**
     * Displayable text of the permalink resource. Can for instance be a user or room name.
     * null here means that there is nothing to display. Most likely if the URL was not a permalink.
     */
    text: string | null;
    /**
     * Should be used for click actions on the permalink.
     * In case of a user permalink, a view profile action is dispatched.
     */
    onClick: (e: ButtonEvent) => void;
    /**
     * This can be for instance a user or room Id.
     * null here means that the resource cannot be detected. Most likely if the URL was not a permalink.
     */
    resourceId: string | null;
    /**
     * Target room of the permalink:
     * For an @room mention, this is the room where the permalink should be displayed.
     * For a room permalink, it is the room from the permalink.
     * null for other links or if the room cannot be found.
     */
    targetRoom: Room | null;
    /**
     * Type of the pill plus "space" for spaces.
     * null here means that the type cannot be detected. Most likely if the URL was not a permalink.
     */
    type: PillType | "space" | null;
    /**
     * Target event of the permalink.
     * Null if unable to load the event.
     */
    event: MatrixEvent | null;
}

/**
 * Tries to determine the pill type.
 *
 * If forcedType is present it will be returned.
 * If the parse result contains a room Id or alias and an event Id:
 * - Type is EventInSameRoom if the permalink room Id or alias equals the parsed room Id or alias
 * - Type is EventInOtherRoom if the permalink room Id or alias not equals the parsed room Id or alias
 * If the parse result contains a primary entity Id it will try to detect the type from it.
 * Otherwise returns null.
 *
 * @param forcedType - Forced pill type. Will be used if present and short-circuits all othe conditions.
 * @param parseResult - Permalink parser result
 * @param permalinkRoom - Room in which the permalink is displayed.
 * @returns Pill type or null if unable to determine.
 */
const determineType = (
    forcedType: PillType | undefined,
    parseResult: PermalinkParts | null,
    permalinkRoom: Room | undefined,
): PillType | null => {
    if (forcedType) return forcedType;

    if (parseResult?.roomIdOrAlias && parseResult?.eventId) {
        if (parseResult.roomIdOrAlias === permalinkRoom?.roomId) {
            return PillType.EventInSameRoom;
        }

        return PillType.EventInOtherRoom;
    }

    if (parseResult?.primaryEntityId) {
        const prefix = parseResult.primaryEntityId[0] || "";
        return (
            {
                "@": PillType.UserMention,
                "#": PillType.RoomMention,
                "!": PillType.RoomMention,
            }[prefix] || null
        );
    }

    return null;
};

/**
 * Can be used to retrieve all information needed to display a permalink.
 */
export const usePermalink: (args: Args) => HookResult = ({
    room: permalinkRoom,
    type: forcedType,
    url,
}): HookResult => {
    let resourceId: string | null = null;
    let parseResult: PermalinkParts | null = null;

    if (url) {
        parseResult = parsePermalink(url);

        if (parseResult?.primaryEntityId) {
            resourceId = parseResult.primaryEntityId;
        }
    }

    const type = determineType(forcedType, parseResult, permalinkRoom);
    const targetRoom = usePermalinkTargetRoom(type, parseResult, permalinkRoom);
    const event = usePermalinkEvent(type, parseResult, targetRoom);
    const member = usePermalinkMember(type, parseResult, targetRoom, event);

    let onClick: (e: ButtonEvent) => void = () => {};
    let text = resourceId;

    if (type === PillType.AtRoomMention && permalinkRoom) {
        text = "@room";
    } else if (type === PillType.UserMention && member) {
        text = member.name || resourceId;
        onClick = (e: ButtonEvent): void => {
            e.preventDefault();
            e.stopPropagation();
            dis.dispatch({
                action: Action.ViewUser,
                member: member,
            });
        };
    } else if (type === PillType.RoomMention) {
        if (targetRoom) {
            text = targetRoom.name || resourceId;
        }
    } else if (type === PillType.EventInSameRoom) {
        text = member?.name || _t("User");
    } else if (type === PillType.EventInOtherRoom) {
        text = targetRoom?.name || _t("Room");
    }

    return {
        event,
        member,
        onClick,
        resourceId,
        targetRoom,
        text,
        type,
    };
};
