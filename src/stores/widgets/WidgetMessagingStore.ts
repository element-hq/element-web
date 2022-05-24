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

import { ClientWidgetApi, Widget, IWidgetApiRequest } from "matrix-widget-api";

import { ElementWidgetActions } from "./ElementWidgetActions";
import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { ActionPayload } from "../../dispatcher/payloads";
import { EnhancedMap } from "../../utils/maps";
import WidgetUtils from "../../utils/WidgetUtils";

export enum WidgetMessagingStoreEvent {
    StoreMessaging = "store_messaging",
    StopMessaging = "stop_messaging",
    WidgetReady = "widget_ready",
}

/**
 * Temporary holding store for widget messaging instances. This is eventually
 * going to be merged with a more complete WidgetStore, but for now it's
 * easiest to split this into a single place.
 */
export class WidgetMessagingStore extends AsyncStoreWithClient<unknown> {
    private static internalInstance = new WidgetMessagingStore();

    private widgetMap = new EnhancedMap<string, ClientWidgetApi>(); // <widget UID, ClientWidgetAPi>
    private readyWidgets = new Set<string>(); // widgets that have sent a WidgetReady event

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

    public storeMessaging(widget: Widget, roomId: string, widgetApi: ClientWidgetApi) {
        this.stopMessaging(widget, roomId);
        const uid = WidgetUtils.calcWidgetUid(widget.id, roomId);
        this.widgetMap.set(uid, widgetApi);

        widgetApi.once(`action:${ElementWidgetActions.WidgetReady}`, (ev: CustomEvent<IWidgetApiRequest>) => {
            this.readyWidgets.add(uid);
            this.emit(WidgetMessagingStoreEvent.WidgetReady, uid);
            widgetApi.transport.reply(ev.detail, {}); // ack
        });

        this.emit(WidgetMessagingStoreEvent.StoreMessaging, uid, widgetApi);
    }

    public stopMessaging(widget: Widget, roomId: string) {
        this.stopMessagingByUid(WidgetUtils.calcWidgetUid(widget.id, roomId));
    }

    public getMessaging(widget: Widget, roomId: string): ClientWidgetApi {
        return this.widgetMap.get(WidgetUtils.calcWidgetUid(widget.id, roomId));
    }

    /**
     * Stops the widget messaging instance for a given widget UID.
     * @param {string} widgetUid The widget UID.
     */
    public stopMessagingByUid(widgetUid: string) {
        this.widgetMap.remove(widgetUid)?.stop();
        this.readyWidgets.delete(widgetUid);
        this.emit(WidgetMessagingStoreEvent.StopMessaging, widgetUid);
    }

    /**
     * Gets the widget messaging class for a given widget UID.
     * @param {string} widgetUid The widget UID.
     * @returns {ClientWidgetApi} The widget API, or a falsy value if not found.
     */
    public getMessagingForUid(widgetUid: string): ClientWidgetApi {
        return this.widgetMap.get(widgetUid);
    }

    /**
     * @param {string} widgetUid The widget UID.
     * @returns {boolean} Whether the widget has issued an ElementWidgetActions.WidgetReady event.
     */
    public isWidgetReady(widgetUid: string): boolean {
        return this.readyWidgets.has(widgetUid);
    }
}
