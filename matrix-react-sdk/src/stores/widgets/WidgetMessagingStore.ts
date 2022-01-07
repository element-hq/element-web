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

/**
 * Temporary holding store for widget messaging instances. This is eventually
 * going to be merged with a more complete WidgetStore, but for now it's
 * easiest to split this into a single place.
 */
export class WidgetMessagingStore extends AsyncStoreWithClient<unknown> {
    private static internalInstance = new WidgetMessagingStore();

    // TODO: Fix uniqueness problem (widget IDs are not unique across the whole app)
    private widgetMap = new EnhancedMap<string, ClientWidgetApi>(); // <widget ID, ClientWidgetAPi>

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

    public storeMessaging(widget: Widget, widgetApi: ClientWidgetApi) {
        this.stopMessaging(widget);
        this.widgetMap.set(widget.id, widgetApi);
    }

    public stopMessaging(widget: Widget) {
        this.widgetMap.remove(widget.id)?.stop();
    }

    public getMessaging(widget: Widget): ClientWidgetApi {
        return this.widgetMap.get(widget.id);
    }

    /**
     * Stops the widget messaging instance for a given widget ID.
     * @param {string} widgetId The widget ID.
     * @deprecated Widget IDs are not globally unique.
     */
    public stopMessagingById(widgetId: string) {
        this.widgetMap.remove(widgetId)?.stop();
    }

    /**
     * Gets the widget messaging class for a given widget ID.
     * @param {string} widgetId The widget ID.
     * @returns {ClientWidgetApi} The widget API, or a falsey value if not found.
     * @deprecated Widget IDs are not globally unique.
     */
    public getMessagingForId(widgetId: string): ClientWidgetApi {
        return this.widgetMap.get(widgetId);
    }
}
