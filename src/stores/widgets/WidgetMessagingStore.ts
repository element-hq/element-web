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
}
