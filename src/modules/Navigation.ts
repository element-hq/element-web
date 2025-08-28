/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type NavigationApi as INavigationApi } from "@element-hq/element-web-module-api";

import { navigateToPermalink } from "../utils/permalinks/navigator.ts";
import { parsePermalink } from "../utils/permalinks/Permalinks.ts";
import { getOrFetchCachedRoomIdForAlias } from "../RoomAliasCache.ts";
import { MatrixClientPeg } from "../MatrixClientPeg.ts";
import dispatcher from "../dispatcher/dispatcher.ts";
import { Action } from "../dispatcher/actions.ts";
import SettingsStore from "../settings/SettingsStore.ts";

export class NavigationApi implements INavigationApi {
    public async toMatrixToLink(link: string, join = false): Promise<void> {
        navigateToPermalink(link);

        const parts = parsePermalink(link);
        if (parts?.roomIdOrAlias && join) {
            let roomId: string | undefined = parts.roomIdOrAlias;
            let viaServers = parts.viaServers;
            if (roomId.startsWith("#")) {
                const result = await getOrFetchCachedRoomIdForAlias(MatrixClientPeg.safeGet(), roomId);
                roomId = result?.roomId;
                if (!viaServers?.length) viaServers = result?.viaServers ?? null; // use provided servers first, if available
            }
            dispatcher.dispatch({
                action: Action.ViewRoom,
                room_id: roomId,
                via_servers: viaServers,
            });

            if (roomId) {
                dispatcher.dispatch({
                    action: Action.JoinRoom,
                    canAskToJoin: SettingsStore.getValue("feature_ask_to_join"),
                    roomId,
                });
            }
        }
    }
}
