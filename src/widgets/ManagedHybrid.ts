/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { IWidget } from "matrix-widget-api";
import { logger } from "matrix-js-sdk/src/logger";

import { MatrixClientPeg } from "../MatrixClientPeg";
import { getCallBehaviourWellKnown } from "../utils/WellKnownUtils";
import WidgetUtils from "../utils/WidgetUtils";
import { IStoredLayout, WidgetLayoutStore } from "../stores/widgets/WidgetLayoutStore";
import WidgetEchoStore from "../stores/WidgetEchoStore";
import WidgetStore from "../stores/WidgetStore";
import SdkConfig from "../SdkConfig";
import DMRoomMap from "../utils/DMRoomMap";

/* eslint-disable camelcase */
interface IManagedHybridWidgetData {
    widget_id: string;
    widget: IWidget;
    layout: IStoredLayout;
}
/* eslint-enable camelcase */

function getWidgetBuildUrl(roomId: string): string | undefined {
    const isDm = !!DMRoomMap.shared().getUserIdForRoomId(roomId);
    if (SdkConfig.get().widget_build_url) {
        if (isDm && SdkConfig.get().widget_build_url_ignore_dm) {
            return undefined;
        }
        return SdkConfig.get().widget_build_url;
    }

    const wellKnown = getCallBehaviourWellKnown(MatrixClientPeg.get());
    if (isDm && wellKnown?.ignore_dm) {
        return undefined;
    }
    /* eslint-disable-next-line camelcase */
    return wellKnown?.widget_build_url;
}

export function isManagedHybridWidgetEnabled(roomId: string): boolean {
    return !!getWidgetBuildUrl(roomId);
}

export async function addManagedHybridWidget(roomId: string): Promise<void> {
    const cli = MatrixClientPeg.get();
    const room = cli.getRoom(roomId);
    if (!room) {
        return;
    }

    // Check for permission
    if (!WidgetUtils.canUserModifyWidgets(cli, roomId)) {
        logger.error(`User not allowed to modify widgets in ${roomId}`);
        return;
    }

    // Get widget data
    /* eslint-disable-next-line camelcase */
    const widgetBuildUrl = getWidgetBuildUrl(roomId);
    if (!widgetBuildUrl) {
        return;
    }
    let widgetData: IManagedHybridWidgetData;
    try {
        const response = await fetch(`${widgetBuildUrl}?roomId=${roomId}`);
        widgetData = await response.json();
    } catch (e) {
        logger.error(`Managed hybrid widget builder failed for room ${roomId}`, e);
        return;
    }
    if (!widgetData) {
        return;
    }
    const { widget_id: widgetId, widget: widgetContent, layout } = widgetData;

    // Ensure the widget is not already present in the room
    let widgets = WidgetStore.instance.getApps(roomId);
    const existing = widgets.some((w) => w.id === widgetId) || WidgetEchoStore.roomHasPendingWidgets(roomId, []);
    if (existing) {
        logger.error(`Managed hybrid widget already present in room ${roomId}`);
        return;
    }

    // Add the widget
    try {
        await WidgetUtils.setRoomWidgetContent(cli, roomId, widgetId, widgetContent);
    } catch (e) {
        logger.error(`Unable to add managed hybrid widget in room ${roomId}`, e);
        return;
    }

    // Move the widget into position
    if (!WidgetLayoutStore.instance.canCopyLayoutToRoom(room)) {
        return;
    }
    widgets = WidgetStore.instance.getApps(roomId);
    const installedWidget = widgets.find((w) => w.id === widgetId);
    if (!installedWidget) {
        return;
    }
    WidgetLayoutStore.instance.moveToContainer(room, installedWidget, layout.container);
    WidgetLayoutStore.instance.setContainerHeight(room, layout.container, layout.height);
    WidgetLayoutStore.instance.copyLayoutToRoom(room);
}
