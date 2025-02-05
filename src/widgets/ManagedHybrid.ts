/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IWidget } from "matrix-widget-api";
import { logger } from "matrix-js-sdk/src/logger";
import { type Room } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../MatrixClientPeg";
import { getCallBehaviourWellKnown } from "../utils/WellKnownUtils";
import WidgetUtils from "../utils/WidgetUtils";
import { type IStoredLayout, WidgetLayoutStore } from "../stores/widgets/WidgetLayoutStore";
import WidgetEchoStore from "../stores/WidgetEchoStore";
import WidgetStore, { type IApp } from "../stores/WidgetStore";
import SdkConfig from "../SdkConfig";
import { getJoinedNonFunctionalMembers } from "../utils/room/getJoinedNonFunctionalMembers";

/* eslint-disable camelcase */
interface IManagedHybridWidgetData {
    widget_id: string;
    widget: IWidget;
    layout: IStoredLayout;
}
/* eslint-enable camelcase */

function getWidgetBuildUrl(room: Room): string | undefined {
    const functionalMembers = getJoinedNonFunctionalMembers(room);
    const isDm = functionalMembers.length === 2;
    if (SdkConfig.get().widget_build_url) {
        if (isDm && SdkConfig.get().widget_build_url_ignore_dm) {
            return undefined;
        }
        return SdkConfig.get().widget_build_url;
    }

    const wellKnown = getCallBehaviourWellKnown(MatrixClientPeg.safeGet());
    if (isDm && wellKnown?.ignore_dm) {
        return undefined;
    }
    /* eslint-disable-next-line camelcase */
    return wellKnown?.widget_build_url;
}

export function isManagedHybridWidgetEnabled(room: Room): boolean {
    return !!getWidgetBuildUrl(room);
}

export async function addManagedHybridWidget(room: Room): Promise<void> {
    // Check for permission
    if (!WidgetUtils.canUserModifyWidgets(room.client, room.roomId)) {
        logger.error(`User not allowed to modify widgets in ${room.roomId}`);
        return;
    }

    // Get widget data
    /* eslint-disable-next-line camelcase */
    const widgetBuildUrl = getWidgetBuildUrl(room);
    if (!widgetBuildUrl) {
        return;
    }
    let widgetData: IManagedHybridWidgetData;
    try {
        const response = await fetch(`${widgetBuildUrl}?roomId=${room.roomId}`);
        widgetData = await response.json();
    } catch (e) {
        logger.error(`Managed hybrid widget builder failed for room ${room.roomId}`, e);
        return;
    }
    if (!widgetData) {
        return;
    }
    const { widget_id: widgetId, widget: widgetContent, layout } = widgetData;

    // Ensure the widget is not already present in the room
    let widgets = WidgetStore.instance.getApps(room.roomId);
    const existing = widgets.some((w) => w.id === widgetId) || WidgetEchoStore.roomHasPendingWidgets(room.roomId, []);
    if (existing) {
        logger.error(`Managed hybrid widget already present in room ${room.roomId}`);
        return;
    }

    // Add the widget
    try {
        await WidgetUtils.setRoomWidgetContent(room.client, room.roomId, widgetId, {
            ...widgetContent,
            "io.element.managed_hybrid": true,
        });
    } catch (e) {
        logger.error(`Unable to add managed hybrid widget in room ${room.roomId}`, e);
        return;
    }

    // Move the widget into position
    if (!WidgetLayoutStore.instance.canCopyLayoutToRoom(room)) {
        return;
    }
    widgets = WidgetStore.instance.getApps(room.roomId);
    const installedWidget = widgets.find((w) => w.id === widgetId);
    if (!installedWidget) {
        return;
    }
    WidgetLayoutStore.instance.moveToContainer(room, installedWidget, layout.container);
    WidgetLayoutStore.instance.setContainerHeight(room, layout.container, layout.height);
    WidgetLayoutStore.instance.copyLayoutToRoom(room);
}

export function isManagedHybridWidget(widget: IApp): boolean {
    return !!widget["io.element.managed_hybrid"];
}
