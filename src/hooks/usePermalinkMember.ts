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
import { useEffect, useState } from "react";

import { PillType } from "../components/views/elements/Pill";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { PermalinkParts } from "../utils/permalinks/PermalinkConstructor";

/**
 * Tries to determine the user Id of a permalink.
 * In case of a user permalink it is the user id.
 * In case of an event permalink it is the sender user Id of the event if that event is available.
 * Otherwise returns null.
 *
 * @param type - pill type
 * @param parseResult - permalink parse result
 * @param event - permalink event, if available
 * @returns permalink user Id. null if the Id cannot be determined.
 */
const determineUserId = (
    type: PillType | null,
    parseResult: PermalinkParts | null,
    event: MatrixEvent | null,
): string | null => {
    if (type === null) return null;

    if (parseResult?.userId) return parseResult.userId;

    if (event && [PillType.EventInSameRoom, PillType.EventInOtherRoom].includes(type)) {
        return event.getSender() ?? null;
    }

    return null;
};

/**
 * Hook to get the permalink member
 *
 * @param type - Permalink type
 * @param parseResult - Permalink parse result
 * @param targetRoom - Permalink target room {@link ./usePermalinkTargetRoom.ts}
 * @param event - Permalink event
 * @returns The permalink member:
 *          - The room member for a user mention
 *          - The sender for a permalink to an event in the same room
 *          - Null in other cases or the user cannot be loaded.
 */
export const usePermalinkMember = (
    type: PillType | null,
    parseResult: PermalinkParts | null,
    targetRoom: Room | null,
    event: MatrixEvent | null,
): RoomMember | null => {
    // User mentions and permalinks to events in the same room require to know the user.
    // If it cannot be initially determined, it will be looked up later by a memo hook.
    const shouldLookUpUser = type && [PillType.UserMention, PillType.EventInSameRoom].includes(type);
    const userId = determineUserId(type, parseResult, event);
    const userInRoom = shouldLookUpUser && userId && targetRoom ? targetRoom.getMember(userId) : null;
    const [member, setMember] = useState<RoomMember | null>(userInRoom);

    useEffect(() => {
        if (!shouldLookUpUser || !userId || member) {
            // nothing to do here
            return;
        }

        const doProfileLookup = (userId: string): void => {
            MatrixClientPeg.get()
                .getProfileInfo(userId)
                .then((resp) => {
                    const newMember = new RoomMember("", userId);
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
        };

        doProfileLookup(userId);
    }, [member, shouldLookUpUser, targetRoom, userId]);

    return member;
};
