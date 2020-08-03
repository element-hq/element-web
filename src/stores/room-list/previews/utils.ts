/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { DefaultTagID, TagID } from "../models";

export function isSelf(event: MatrixEvent): boolean {
    const selfUserId = MatrixClientPeg.get().getUserId();
    if (event.getType() === 'm.room.member') {
        return event.getStateKey() === selfUserId;
    }
    return event.getSender() === selfUserId;
}

export function isSelfTarget(event: MatrixEvent): boolean {
    const selfUserId = MatrixClientPeg.get().getUserId();
    return event.getStateKey() === selfUserId;
}

export function shouldPrefixMessagesIn(roomId: string, tagId: TagID): boolean {
    if (tagId !== DefaultTagID.DM) return true;

    // We don't prefix anything in 1:1s
    const room = MatrixClientPeg.get().getRoom(roomId);
    if (!room) return true;
    return room.currentState.getJoinedMemberCount() !== 2;
}

export function getSenderName(event: MatrixEvent): string {
    return event.sender ? event.sender.name : event.getSender();
}

export function getTargetName(event: MatrixEvent): string {
    return event.target ? event.target.name : event.getStateKey();
}
