/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Container, type WidgetApi as WidgetApiInterface } from "@element-hq/element-web-module-api";
import { getHttpUriForMxc } from "matrix-js-sdk/src/matrix";

import type { IWidget } from "matrix-widget-api";
import WidgetStore, { isAppWidget } from "../stores/WidgetStore";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { WidgetLayoutStore } from "../stores/widgets/WidgetLayoutStore";

/**
 * Host-side implementation of the widget API.
 * Allows modules to interact with widgets, including listing widgets in rooms.
 */
export class WidgetApi implements WidgetApiInterface {
    public getWidgetsInRoom(roomId: string): IWidget[] {
        return WidgetStore.instance.getApps(roomId);
    }

    public getAppAvatarUrl(app: IWidget, width?: number, height?: number, resizeMethod?: string): string | null {
        if (!isAppWidget(app) || !app.avatar_url) return null;
        return getHttpUriForMxc(
            MatrixClientPeg.safeGet().getHomeserverUrl(),
            app.avatar_url,
            width,
            height,
            resizeMethod,
        );
    }

    public isAppInContainer(app: IWidget, container: Container, roomId: string): boolean {
        const room = MatrixClientPeg.safeGet().getRoom(roomId);
        if (!room) return false;
        return WidgetLayoutStore.instance.isInContainer(room, app, container);
    }

    public moveAppToContainer(app: IWidget, container: Container, roomId: string): void {
        const room = MatrixClientPeg.safeGet().getRoom(roomId);
        if (!room) return;
        WidgetLayoutStore.instance.moveToContainer(room, app, container);
    }
}
