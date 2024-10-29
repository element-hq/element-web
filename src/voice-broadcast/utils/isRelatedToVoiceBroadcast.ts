/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { MatrixClient, MatrixEvent, RelationType } from "matrix-js-sdk/src/matrix";

import { VoiceBroadcastInfoEventType } from "../types";

export const isRelatedToVoiceBroadcast = (event: MatrixEvent, client: MatrixClient): boolean => {
    const relation = event.getRelation();

    return (
        relation?.rel_type === RelationType.Reference &&
        !!relation.event_id &&
        client.getRoom(event.getRoomId())?.findEventById(relation.event_id)?.getType() === VoiceBroadcastInfoEventType
    );
};
