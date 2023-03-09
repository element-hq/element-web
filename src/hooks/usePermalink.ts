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

import { logger } from "matrix-js-sdk/src/logger";
import { MatrixEvent, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import { useCallback, useMemo, useState } from "react";

import { ButtonEvent } from "../components/views/elements/AccessibleButton";
import { PillType } from "../components/views/elements/Pill";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { parsePermalink } from "../utils/permalinks/Permalinks";
import dis from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";

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
}

/**
 * Can be used to retrieve all information to display a permalink.
 */
export const usePermalink: (args: Args) => HookResult = ({ room, type: argType, url }): HookResult => {
    const [member, setMember] = useState<RoomMember | null>(null);
    // room of the entity this pill points to
    const [targetRoom, setTargetRoom] = useState<Room | null>(room ?? null);

    let resourceId: string | null = null;

    if (url) {
        const parseResult = parsePermalink(url);

        if (parseResult?.primaryEntityId) {
            resourceId = parseResult.primaryEntityId;
        }
    }
    const prefix = resourceId ? resourceId[0] : "";
    const type =
        argType ||
        // try to detect the permalink type from the URL prefix
        {
            "@": PillType.UserMention,
            "#": PillType.RoomMention,
            "!": PillType.RoomMention,
        }[prefix] ||
        null;

    const doProfileLookup = useCallback((userId: string, member: RoomMember): void => {
        MatrixClientPeg.get()
            .getProfileInfo(userId)
            .then((resp) => {
                const newMember = new RoomMember(member.roomId, userId);
                newMember.name = resp.displayname || userId;
                newMember.rawDisplayName = resp.displayname || userId;
                newMember.getMxcAvatarUrl();
                newMember.events.member = {
                    getContent: () => {
                        return { avatar_url: resp.avatar_url };
                    },
                    getDirectionalContent: function () {
                        // eslint-disable-next-line
                        return this.getContent();
                    },
                } as MatrixEvent;
                setMember(newMember);
            })
            .catch((err) => {
                logger.error("Could not retrieve profile data for " + userId + ":", err);
            });
    }, []);

    useMemo(() => {
        switch (type) {
            case PillType.UserMention:
                {
                    if (resourceId) {
                        let member = room?.getMember(resourceId) || null;
                        setMember(member);

                        if (!member) {
                            member = new RoomMember("", resourceId);
                            doProfileLookup(resourceId, member);
                        }
                    }
                }
                break;
            case PillType.RoomMention:
                {
                    if (resourceId) {
                        const newRoom =
                            resourceId[0] === "#"
                                ? MatrixClientPeg.get()
                                      .getRooms()
                                      .find((r) => {
                                          return (
                                              r.getCanonicalAlias() === resourceId ||
                                              (resourceId && r.getAltAliases().includes(resourceId))
                                          );
                                      })
                                : MatrixClientPeg.get().getRoom(resourceId);
                        setTargetRoom(newRoom || null);
                    }
                }
                break;
        }
    }, [doProfileLookup, type, resourceId, room]);

    let onClick: (e: ButtonEvent) => void = () => {};
    let text = resourceId;

    if (type === PillType.AtRoomMention && room) {
        text = "@room";
    } else if (type === PillType.UserMention && member) {
        text = member.name || resourceId;
        onClick = (e: ButtonEvent): void => {
            e.preventDefault();
            dis.dispatch({
                action: Action.ViewUser,
                member: member,
            });
        };
    } else if (type === PillType.RoomMention) {
        if (targetRoom) {
            text = targetRoom.name || resourceId;
        }
    }

    return {
        member,
        onClick,
        resourceId,
        targetRoom,
        text,
        type,
    };
};
