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

import { MatrixClientPeg } from '../../MatrixClientPeg';
import MatrixClientBackedSettingsHandler from "./MatrixClientBackedSettingsHandler";
import { objectClone, objectKeyChanges } from "../../utils/objects";
import { SettingLevel } from "../SettingLevel";
import { WatchManager } from "../WatchManager";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { RoomState } from "matrix-js-sdk/src/models/room-state";

/**
 * Gets and sets settings at the "room" level.
 */
export default class RoomSettingsHandler extends MatrixClientBackedSettingsHandler {
    constructor(private watchers: WatchManager) {
        super();
    }

    protected initMatrixClient(oldClient: MatrixClient, newClient: MatrixClient) {
        if (oldClient) {
            oldClient.removeListener("RoomState.events", this.onEvent);
        }

        newClient.on("RoomState.events", this.onEvent);
    }

    private onEvent = (event: MatrixEvent, state: RoomState, prevEvent: MatrixEvent) => {
        const roomId = event.getRoomId();
        const room = this.client.getRoom(roomId);

        // Note: in tests and during the encryption setup on initial load we might not have
        // rooms in the store, so we just quietly ignore the problem. If we log it then we'll
        // just end up spamming the logs a few thousand times. It is perfectly fine for us
        // to ignore the problem as the app will not have loaded enough to care yet.
        if (!room) return;

        // ignore state updates which are not current
        if (room && state !== room.currentState) return;

        if (event.getType() === "org.matrix.room.preview_urls") {
            let val = event.getContent()['disable'];
            if (typeof (val) !== "boolean") {
                val = null;
            } else {
                val = !val;
            }

            this.watchers.notifyUpdate("urlPreviewsEnabled", roomId, SettingLevel.ROOM, val);
        } else if (event.getType() === "im.vector.web.settings") {
            // Figure out what changed and fire those updates
            const prevContent = prevEvent ? prevEvent.getContent() : {};
            const changedSettings = objectKeyChanges<Record<string, any>>(prevContent, event.getContent());
            for (const settingName of changedSettings) {
                this.watchers.notifyUpdate(settingName, roomId, SettingLevel.ROOM,
                    event.getContent()[settingName]);
            }
        }
    };

    public getValue(settingName: string, roomId: string): any {
        // Special case URL previews
        if (settingName === "urlPreviewsEnabled") {
            const content = this.getSettings(roomId, "org.matrix.room.preview_urls") || {};

            // Check to make sure that we actually got a boolean
            if (typeof (content['disable']) !== "boolean") return null;
            return !content['disable'];
        }

        const settings = this.getSettings(roomId) || {};
        return settings[settingName];
    }

    public setValue(settingName: string, roomId: string, newValue: any): Promise<void> {
        // Special case URL previews
        if (settingName === "urlPreviewsEnabled") {
            const content = this.getSettings(roomId, "org.matrix.room.preview_urls") || {};
            content['disable'] = !newValue;
            return MatrixClientPeg.get().sendStateEvent(roomId, "org.matrix.room.preview_urls", content);
        }

        const content = this.getSettings(roomId) || {};
        content[settingName] = newValue;
        return MatrixClientPeg.get().sendStateEvent(roomId, "im.vector.web.settings", content, "");
    }

    public canSetValue(settingName: string, roomId: string): boolean {
        const cli = MatrixClientPeg.get();
        const room = cli.getRoom(roomId);

        let eventType = "im.vector.web.settings";
        if (settingName === "urlPreviewsEnabled") eventType = "org.matrix.room.preview_urls";

        if (!room) return false;
        return room.currentState.maySendStateEvent(eventType, cli.getUserId());
    }

    public isSupported(): boolean {
        const cli = MatrixClientPeg.get();
        return cli !== undefined && cli !== null;
    }

    private getSettings(roomId: string, eventType = "im.vector.web.settings"): any {
        const room = MatrixClientPeg.get().getRoom(roomId);
        if (!room) return null;

        const event = room.currentState.getStateEvents(eventType, "");
        if (!event || !event.getContent()) return null;
        return objectClone(event.getContent()); // clone to prevent mutation
    }
}
