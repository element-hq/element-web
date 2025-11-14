/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {
    LocationRenderFunction,
    NavigationApi as INavigationApi,
    OpenRoomOptions,
} from "@element-hq/element-web-module-api";
import { navigateToPermalink } from "../utils/permalinks/navigator.ts";
import { parsePermalink } from "../utils/permalinks/Permalinks.ts";
import dispatcher from "../dispatcher/dispatcher.ts";
import { Action } from "../dispatcher/actions.ts";
import type { ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload.ts";

export class NavigationApi implements INavigationApi {
    public locationRenderers = new Map<string, LocationRenderFunction>();

    public async toMatrixToLink(link: string, join = false): Promise<void> {
        navigateToPermalink(link);

        const parts = parsePermalink(link);
        if (parts?.roomIdOrAlias) {
            this.openRoom(parts.roomIdOrAlias, {
                viaServers: parts.viaServers ?? undefined,
                autoJoin: join,
            });
        }
    }

    public registerLocationRenderer(path: string, renderer: LocationRenderFunction): void {
        this.locationRenderers.set(path, renderer);
    }

    public openRoom(roomIdOrAlias: string, opts: OpenRoomOptions = {}): void {
        const key = roomIdOrAlias.startsWith("#") ? "room_alias" : "room_id";
        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            [key]: roomIdOrAlias,
            via_servers: opts.viaServers,
            auto_join: opts.autoJoin,
            metricsTrigger: undefined,
        });
    }
}
