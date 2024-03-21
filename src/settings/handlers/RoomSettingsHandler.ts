/*
Copyright 2017 Travis Ralston
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import { MatrixClient, MatrixEvent, RoomState, RoomStateEvent, StateEvents } from "matrix-js-sdk/src/matrix";
import { defer } from "matrix-js-sdk/src/utils";

import MatrixClientBackedSettingsHandler from "./MatrixClientBackedSettingsHandler";
import { objectClone, objectKeyChanges } from "../../utils/objects";
import { SettingLevel } from "../SettingLevel";
import { WatchManager } from "../WatchManager";

const DEFAULT_SETTINGS_EVENT_TYPE = "im.vector.web.settings";
const PREVIEW_URLS_EVENT_TYPE = "org.matrix.room.preview_urls";

type RoomSettingsEventType = typeof DEFAULT_SETTINGS_EVENT_TYPE | typeof PREVIEW_URLS_EVENT_TYPE;

/**
 * Gets and sets settings at the "room" level.
 */
export default class RoomSettingsHandler extends MatrixClientBackedSettingsHandler {
    public constructor(public readonly watchers: WatchManager) {
        super();
    }

    protected initMatrixClient(oldClient: MatrixClient, newClient: MatrixClient): void {
        if (oldClient) {
            oldClient.removeListener(RoomStateEvent.Events, this.onEvent);
        }

        newClient.on(RoomStateEvent.Events, this.onEvent);
    }

    private onEvent = (event: MatrixEvent, state: RoomState, prevEvent: MatrixEvent | null): void => {
        const roomId = event.getRoomId()!;
        const room = this.client.getRoom(roomId);

        // Note: in tests and during the encryption setup on initial load we might not have
        // rooms in the store, so we just quietly ignore the problem. If we log it then we'll
        // just end up spamming the logs a few thousand times. It is perfectly fine for us
        // to ignore the problem as the app will not have loaded enough to care yet.
        if (!room) return;

        // ignore state updates which are not current
        if (room && state !== room.currentState) return;

        if (event.getType() === "org.matrix.room.preview_urls") {
            let val = event.getContent()["disable"];
            if (typeof val !== "boolean") {
                val = null;
            } else {
                val = !val;
            }

            this.watchers.notifyUpdate("urlPreviewsEnabled", roomId, SettingLevel.ROOM, val);
        } else if (event.getType() === DEFAULT_SETTINGS_EVENT_TYPE) {
            // Figure out what changed and fire those updates
            const prevContent = prevEvent?.getContent() ?? {};
            const changedSettings = objectKeyChanges<Record<string, any>>(prevContent, event.getContent());
            for (const settingName of changedSettings) {
                this.watchers.notifyUpdate(settingName, roomId, SettingLevel.ROOM, event.getContent()[settingName]);
            }
        }
    };

    public getValue(settingName: string, roomId: string): any {
        // Special case URL previews
        if (settingName === "urlPreviewsEnabled") {
            const content = this.getSettings(roomId, "org.matrix.room.preview_urls") || {};

            // Check to make sure that we actually got a boolean
            if (typeof content["disable"] !== "boolean") return null;
            return !content["disable"];
        }

        const settings = this.getSettings(roomId) || {};
        return settings[settingName];
    }

    // helper function to send state event then await it being echoed back
    private async sendStateEvent<K extends RoomSettingsEventType, F extends keyof StateEvents[K]>(
        roomId: string,
        eventType: K,
        field: F,
        value: StateEvents[K][F],
    ): Promise<void> {
        const content = this.getSettings(roomId, eventType) || {};
        content[field] = value;

        const { event_id: eventId } = await this.client.sendStateEvent(roomId, eventType, content);

        const deferred = defer<void>();
        const handler = (event: MatrixEvent): void => {
            if (event.getId() !== eventId) return;
            this.client.off(RoomStateEvent.Events, handler);
            deferred.resolve();
        };
        this.client.on(RoomStateEvent.Events, handler);

        await deferred.promise;
    }

    public setValue(settingName: string, roomId: string, newValue: any): Promise<void> {
        switch (settingName) {
            // Special case URL previews
            case "urlPreviewsEnabled":
                return this.sendStateEvent(roomId, "org.matrix.room.preview_urls", "disable", !newValue);

            default:
                return this.sendStateEvent(roomId, DEFAULT_SETTINGS_EVENT_TYPE, settingName, newValue);
        }
    }

    public canSetValue(settingName: string, roomId: string): boolean {
        const room = this.client.getRoom(roomId);

        let eventType = DEFAULT_SETTINGS_EVENT_TYPE;
        if (settingName === "urlPreviewsEnabled") eventType = "org.matrix.room.preview_urls";

        return room?.currentState.maySendStateEvent(eventType, this.client.getUserId()!) ?? false;
    }

    public isSupported(): boolean {
        return !!this.client;
    }

    private getSettings(roomId: string, eventType = DEFAULT_SETTINGS_EVENT_TYPE): any {
        const event = this.client.getRoom(roomId)?.currentState.getStateEvents(eventType, "");
        if (!event?.getContent()) return null;
        return objectClone(event.getContent()); // clone to prevent mutation
    }
}
