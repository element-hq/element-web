/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type NavigationApi as INavigationApi } from "@element-hq/element-web-module-api";

import { navigateToPermalink } from "../utils/permalinks/navigator.ts";
import { parsePermalink } from "../utils/permalinks/Permalinks.ts";
import dispatcher from "../dispatcher/dispatcher.ts";
import { Action } from "../dispatcher/actions.ts";
import type { ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload.ts";

export class NavigationApi implements INavigationApi {
    public async toMatrixToLink(link: string, join = false): Promise<void> {
        navigateToPermalink(link);

        const parts = parsePermalink(link);
        if (parts?.roomIdOrAlias) {
            if (parts.roomIdOrAlias.startsWith("#")) {
                dispatcher.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    room_alias: parts.roomIdOrAlias,
                    via_servers: parts.viaServers ?? undefined,
                    auto_join: join,
                    metricsTrigger: undefined,
                });
            } else {
                dispatcher.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    room_id: parts.roomIdOrAlias,
                    via_servers: parts.viaServers ?? undefined,
                    auto_join: join,
                    metricsTrigger: undefined,
                });
            }
        }
    }
}
