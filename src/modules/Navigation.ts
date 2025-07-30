/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type NavigationApi as INavigationApi } from "@element-hq/element-web-module-api";

import { navigateToPermalink } from "../utils/permalinks/navigator.ts";
import { parsePermalink } from "../utils/permalinks/Permalinks.ts";
import { getCachedRoomIDForAlias } from "../RoomAliasCache.ts";
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
            if (roomId.startsWith("#")) {
                roomId = getCachedRoomIDForAlias(parts.roomIdOrAlias);
                if (!roomId) {
                    // alias resolution failed
                    const result = await MatrixClientPeg.safeGet().getRoomIdForAlias(parts.roomIdOrAlias);
                    roomId = result.room_id;
                }
            }

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
