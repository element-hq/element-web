/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";

import SpaceStore from "../stores/spaces/SpaceStore";
import { _t } from "../languageHandler";
import DMRoomMap from "./DMRoomMap";
import { formatList } from "./FormattingUtils";

export interface RoomContextDetails {
    details: string | null;
    ariaLabel?: string;
}

export function roomContextDetails(room: Room): RoomContextDetails | null {
    const dmPartner = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
    // if we’ve got more than 2 users, don’t treat it like a regular DM
    const isGroupDm = room.getMembers().length > 2;
    if (!room.isSpaceRoom() && dmPartner && !isGroupDm) {
        return { details: dmPartner };
    }

    const [parent, secondParent, ...otherParents] = SpaceStore.instance.getKnownParents(room.roomId);
    if (secondParent && !otherParents?.length) {
        // exactly 2 edge case for improved i18n
        const space1Name = room.client.getRoom(parent)?.name;
        const space2Name = room.client.getRoom(secondParent)?.name;
        return {
            details: formatList([space1Name ?? "", space2Name ?? ""]),
            ariaLabel: _t("in_space1_and_space2", { space1Name, space2Name }),
        };
    } else if (parent) {
        const spaceName = room.client.getRoom(parent)?.name ?? "";
        const count = otherParents.length;
        if (count > 0) {
            return {
                details: formatList([spaceName, ...otherParents], 1),
                ariaLabel: _t("in_space_and_n_other_spaces", { spaceName, count }),
            };
        }
        return {
            details: spaceName,
            ariaLabel: _t("in_space", { spaceName }),
        };
    }

    return { details: room.getCanonicalAlias() };
}
