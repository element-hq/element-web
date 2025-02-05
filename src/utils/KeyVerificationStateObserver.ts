/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { _t } from "../languageHandler";

export function getNameForEventRoom(matrixClient: MatrixClient, userId: string, roomId: string): string {
    const room = matrixClient.getRoom(roomId);
    const member = room && room.getMember(userId);
    return member ? member.name : userId;
}

export function userLabelForEventRoom(matrixClient: MatrixClient, userId: string, roomId: string): string {
    const name = getNameForEventRoom(matrixClient, userId, roomId);
    if (name !== userId) {
        return _t("name_and_id", { name, userId });
    } else {
        return userId;
    }
}
