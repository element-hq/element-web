/*
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ClientWidgetApi, Widget } from "matrix-widget-api";

import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { ActionPayload } from "../../dispatcher/payloads";
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
export class WidgetMessagingStore extends AsyncStoreWithClient<{}> {
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
