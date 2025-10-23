/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { ActionsApi as IActionsApi } from "@element-hq/element-web-module-api";
import type { ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload";
import dispatcher from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";

export class ActionsApi implements IActionsApi {
    public openRoom(roomId: string): void {
        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: roomId,
            metricsTrigger: undefined, // other
        });
    }
}
