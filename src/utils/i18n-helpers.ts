/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { Room } from "matrix-js-sdk/src/models/room";

import SpaceStore from "../stores/spaces/SpaceStore";
import { _t } from "../languageHandler";
import DMRoomMap from "./DMRoomMap";

export function spaceContextDetailsText(space: Room): string {
    if (!space.isSpaceRoom()) return undefined;

    const [parent, secondParent, ...otherParents] = SpaceStore.instance.getKnownParents(space.roomId);
    if (secondParent && !otherParents?.length) {
        // exactly 2 edge case for improved i18n
        return _t("%(space1Name)s and %(space2Name)s", {
            space1Name: space.client.getRoom(parent)?.name,
            space2Name: space.client.getRoom(secondParent)?.name,
        });
    } else if (parent) {
        return _t("%(spaceName)s and %(count)s others", {
            spaceName: space.client.getRoom(parent)?.name,
            count: otherParents.length,
        });
    }

    return space.getCanonicalAlias();
}

export function roomContextDetailsText(room: Room): string {
    if (room.isSpaceRoom()) return undefined;

    const dmPartner = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
    if (dmPartner) {
        return dmPartner;
    }

    const [parent, secondParent, ...otherParents] = SpaceStore.instance.getKnownParents(room.roomId);
    if (secondParent && !otherParents?.length) {
        // exactly 2 edge case for improved i18n
        return _t("%(space1Name)s and %(space2Name)s", {
            space1Name: room.client.getRoom(parent)?.name,
            space2Name: room.client.getRoom(secondParent)?.name,
        });
    } else if (parent) {
        return _t("%(spaceName)s and %(count)s others", {
            spaceName: room.client.getRoom(parent)?.name,
            count: otherParents.length,
        });
    }

    return room.getCanonicalAlias();
}
