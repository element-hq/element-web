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
import React, { ReactElement, useCallback, useMemo, useState } from "react";

import { ButtonEvent } from "../components/views/elements/AccessibleButton";
import { PillType } from "../components/views/elements/Pill";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { parsePermalink } from "../utils/permalinks/Permalinks";
import dis from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import RoomAvatar from "../components/views/avatars/RoomAvatar";
import MemberAvatar from "../components/views/avatars/MemberAvatar";

interface Args {
    /** Room in which the permalink should be displayed. */
    room?: Room;
    /** When set forces the permalink type. */
    type?: PillType;
    /** Permalink URL. */
    url?: string;
}

interface HookResult {
    /** Avatar of the permalinked resource. */
    avatar: ReactElement | null;
    /** Displayable text of the permalink resource. Can for instance be a user or room name. */
    text: string | null;
    onClick: ((e: ButtonEvent) => void) | null;
    /** This can be for instance a user or room Id. */
    resourceId: string | null;
    type: PillType | "space" | null;
}

/**
 * Can be used to retrieve all information to display a permalink.
 */
export const usePermalink: (args: Args) => HookResult = ({ room, type: argType, url }): HookResult => {
    const [member, setMember] = useState<RoomMember | null>(null);
    // room of the entity this pill points to
    const [targetRoom, setTargetRoom] = useState<Room | undefined | null>(room);

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
            case PillType.AtRoomMention:
                setTargetRoom(room);
                break;
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
                        setTargetRoom(newRoom);
                    }
                }
                break;
        }
    }, [doProfileLookup, type, resourceId, room]);

    let onClick: ((e: ButtonEvent) => void) | null = null;
    let avatar: ReactElement | null = null;
    let text = resourceId;

    if (type === PillType.AtRoomMention && room) {
        text = "@room";
        avatar = <RoomAvatar room={room} width={16} height={16} aria-hidden="true" />;
    } else if (type === PillType.UserMention && member) {
        text = member.name || resourceId;
        avatar = <MemberAvatar member={member} width={16} height={16} aria-hidden="true" hideTitle />;
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
            avatar = <RoomAvatar room={targetRoom} width={16} height={16} aria-hidden="true" />;
        }
    }

    return {
        avatar,
        text,
        onClick,
        resourceId,
        type,
    };
};
