/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type TimelineRenderingType } from "./contexts/RoomContext";

export const editorRoomKey = (roomId: string, context: TimelineRenderingType): string =>
    `mx_edit_room_${roomId}_${context}`;
export const editorStateKey = (eventId: string): string => `mx_edit_state_${eventId}`;
