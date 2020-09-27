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

import { ClientWidgetApi, Widget, WidgetDriver, WidgetKind } from "matrix-widget-api";
import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { ActionPayload } from "../../dispatcher/payloads";
import { Room } from "matrix-js-sdk/src/models/room";
import { WidgetSurrogate } from "./WidgetSurrogate";
import { SdkWidgetDriver } from "./SdkWidgetDriver";
import { EnhancedMap } from "../../utils/maps";

/**
 * Temporary holding store for widget messaging instances. This is eventually
 * going to be merged with a more complete WidgetStore, but for now it's
 * easiest to split this into a single place.
 */
export class WidgetMessagingStore extends AsyncStoreWithClient<unknown> {
    private static internalInstance = new WidgetMessagingStore();

    // <room/user ID, <widget ID, Widget>>
    private widgetMap = new EnhancedMap<string, EnhancedMap<string, WidgetSurrogate>>();

    public constructor() {
        super(defaultDispatcher);
    }

    public static get instance(): WidgetMessagingStore {
        return WidgetMessagingStore.internalInstance;
    }

    protected async onAction(payload: ActionPayload): Promise<any> {
        // nothing to do
    }

    protected async onReady(): Promise<any> {
        // just in case
        this.widgetMap.clear();
    }

    /**
     * Gets the messaging instance for the widget. Returns a falsey value if none
     * is present.
     * @param {Room} room The room for which the widget lives within.
     * @param {Widget} widget The widget to get messaging for.
     * @returns {ClientWidgetApi} The messaging, or a falsey value.
     */
    public messagingForRoomWidget(room: Room, widget: Widget): ClientWidgetApi {
        return this.widgetMap.get(room.roomId)?.get(widget.id)?.messaging;
    }

    /**
     * Gets the messaging instance for the widget. Returns a falsey value if none
     * is present.
     * @param {Widget} widget The widget to get messaging for.
     * @returns {ClientWidgetApi} The messaging, or a falsey value.
     */
    public messagingForAccountWidget(widget: Widget): ClientWidgetApi {
        return this.widgetMap.get(this.matrixClient?.getUserId())?.get(widget.id)?.messaging;
    }

    private generateMessaging(locationId: string, widget: Widget, iframe: HTMLIFrameElement, driver: WidgetDriver) {
        const messaging = new ClientWidgetApi(widget, iframe, driver);
        this.widgetMap.getOrCreate(locationId, new EnhancedMap())
            .getOrCreate(widget.id, new WidgetSurrogate(widget, messaging));
        return messaging;
    }

    /**
     * Generates a messaging instance for the widget. If an instance already exists, it
     * will be returned instead.
     * @param {Room} room The room in which the widget lives.
     * @param {Widget} widget The widget to generate/get messaging for.
     * @param {HTMLIFrameElement} iframe The widget's iframe.
     * @returns {ClientWidgetApi} The generated/cached messaging.
     */
    public generateMessagingForRoomWidget(room: Room, widget: Widget, iframe: HTMLIFrameElement): ClientWidgetApi {
        const existing = this.messagingForRoomWidget(room, widget);
        if (existing) return existing;

        const driver = new SdkWidgetDriver(widget, WidgetKind.Room, room.roomId);
        return this.generateMessaging(room.roomId, widget, iframe, driver);
    }

    /**
     * Generates a messaging instance for the widget. If an instance already exists, it
     * will be returned instead.
     * @param {Widget} widget The widget to generate/get messaging for.
     * @param {HTMLIFrameElement} iframe The widget's iframe.
     * @returns {ClientWidgetApi} The generated/cached messaging.
     */
    public generateMessagingForAccountWidget(widget: Widget, iframe: HTMLIFrameElement): ClientWidgetApi {
        if (!this.matrixClient) {
            throw new Error("No matrix client to create account widgets with");
        }

        const existing = this.messagingForAccountWidget(widget);
        if (existing) return existing;

        const userId = this.matrixClient.getUserId();
        const driver = new SdkWidgetDriver(widget, WidgetKind.Account, userId);
        return this.generateMessaging(userId, widget, iframe, driver);
    }

    /**
     * Stops the messaging instance for the widget, unregistering it.
     * @param {Room} room The room where the widget resides.
     * @param {Widget} widget The widget
     */
    public stopMessagingForRoomWidget(room: Room, widget: Widget) {
        const api = this.widgetMap.getOrCreate(room.roomId, new EnhancedMap()).remove(widget.id);
        if (api) api.messaging.stop();
    }

    /**
     * Stops the messaging instance for the widget, unregistering it.
     * @param {Widget} widget The widget
     */
    public stopMessagingForAccountWidget(widget: Widget) {
        if (!this.matrixClient) return;
        const api = this.widgetMap.getOrCreate(this.matrixClient.getUserId(), new EnhancedMap()).remove(widget.id);
        if (api) api.messaging.stop();
    }
}
