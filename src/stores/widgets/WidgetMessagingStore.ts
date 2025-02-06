/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type ClientWidgetApi, type Widget } from "matrix-widget-api";
import { type EmptyObject } from "matrix-js-sdk/src/matrix";

import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { type ActionPayload } from "../../dispatcher/payloads";
import { EnhancedMap } from "../../utils/maps";
import WidgetUtils from "../../utils/WidgetUtils";

export enum WidgetMessagingStoreEvent {
    StoreMessaging = "store_messaging",
    StopMessaging = "stop_messaging",
}

/**
 * Temporary holding store for widget messaging instances. This is eventually
 * going to be merged with a more complete WidgetStore, but for now it's
 * easiest to split this into a single place.
 */
export class WidgetMessagingStore extends AsyncStoreWithClient<EmptyObject> {
    private static readonly internalInstance = (() => {
        const instance = new WidgetMessagingStore();
        instance.start();
        return instance;
    })();

    private widgetMap = new EnhancedMap<string, ClientWidgetApi>(); // <widget UID, ClientWidgetAPi>

    public constructor() {
        super(defaultDispatcher);
    }

    public static get instance(): WidgetMessagingStore {
        return WidgetMessagingStore.internalInstance;
    }

    protected async onAction(payload: ActionPayload): Promise<void> {
        // nothing to do
    }

    protected async onReady(): Promise<any> {
        // just in case
        this.widgetMap.clear();
    }

    public storeMessaging(widget: Widget, roomId: string | undefined, widgetApi: ClientWidgetApi): void {
        this.stopMessaging(widget, roomId);
        const uid = WidgetUtils.calcWidgetUid(widget.id, roomId);
        this.widgetMap.set(uid, widgetApi);

        this.emit(WidgetMessagingStoreEvent.StoreMessaging, uid, widgetApi);
    }

    public stopMessaging(widget: Widget, roomId: string | undefined): void {
        this.stopMessagingByUid(WidgetUtils.calcWidgetUid(widget.id, roomId));
    }

    public getMessaging(widget: Widget, roomId: string | undefined): ClientWidgetApi | undefined {
        return this.widgetMap.get(WidgetUtils.calcWidgetUid(widget.id, roomId));
    }

    /**
     * Stops the widget messaging instance for a given widget UID.
     * @param {string} widgetUid The widget UID.
     */
    public stopMessagingByUid(widgetUid: string): void {
        this.widgetMap.remove(widgetUid)?.stop();
        this.emit(WidgetMessagingStoreEvent.StopMessaging, widgetUid);
    }

    /**
     * Gets the widget messaging class for a given widget UID.
     * @param {string} widgetUid The widget UID.
     * @returns {ClientWidgetApi} The widget API, or a falsy value if not found.
     */
    public getMessagingForUid(widgetUid: string): ClientWidgetApi | undefined {
        return this.widgetMap.get(widgetUid);
    }
}
