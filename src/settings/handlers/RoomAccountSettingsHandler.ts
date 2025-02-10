/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2017 Travis Ralston

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type MatrixEvent, type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { defer } from "matrix-js-sdk/src/utils";

import MatrixClientBackedSettingsHandler from "./MatrixClientBackedSettingsHandler";
import { objectClone, objectKeyChanges } from "../../utils/objects";
import { SettingLevel } from "../SettingLevel";
import { type WatchManager } from "../WatchManager";

const ALLOWED_WIDGETS_EVENT_TYPE = "im.vector.setting.allowed_widgets";
const DEFAULT_SETTINGS_EVENT_TYPE = "im.vector.web.settings";

/**
 * Gets and sets settings at the "room-account" level for the current user.
 */
export default class RoomAccountSettingsHandler extends MatrixClientBackedSettingsHandler {
    public constructor(public readonly watchers: WatchManager) {
        super();
    }

    protected initMatrixClient(oldClient: MatrixClient, newClient: MatrixClient): void {
        if (oldClient) {
            oldClient.removeListener(RoomEvent.AccountData, this.onAccountData);
        }

        newClient.on(RoomEvent.AccountData, this.onAccountData);
    }

    private onAccountData = (event: MatrixEvent, room: Room, prevEvent?: MatrixEvent): void => {
        const roomId = room.roomId;

        if (event.getType() === "org.matrix.room.preview_urls") {
            let val = event.getContent()["disable"];
            if (typeof val !== "boolean") {
                val = null;
            } else {
                val = !val;
            }

            this.watchers.notifyUpdate("urlPreviewsEnabled", roomId, SettingLevel.ROOM_ACCOUNT, val);
        } else if (event.getType() === DEFAULT_SETTINGS_EVENT_TYPE) {
            // Figure out what changed and fire those updates
            const prevContent = prevEvent?.getContent() ?? {};
            const changedSettings = objectKeyChanges<Record<string, any>>(prevContent, event.getContent());
            for (const settingName of changedSettings) {
                const val = event.getContent()[settingName];
                this.watchers.notifyUpdate(settingName, roomId, SettingLevel.ROOM_ACCOUNT, val);
            }
        } else if (event.getType() === ALLOWED_WIDGETS_EVENT_TYPE) {
            this.watchers.notifyUpdate("allowedWidgets", roomId, SettingLevel.ROOM_ACCOUNT, event.getContent());
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

        // Special case allowed widgets
        if (settingName === "allowedWidgets") {
            return this.getSettings(roomId, ALLOWED_WIDGETS_EVENT_TYPE);
        }

        const settings = this.getSettings(roomId) || {};
        return settings[settingName];
    }

    // helper function to send room account data then await it being echoed back
    private async setRoomAccountData(
        roomId: string,
        eventType: string,
        field: string | null,
        value: any,
    ): Promise<void> {
        let content: ReturnType<RoomAccountSettingsHandler["getSettings"]>;

        if (field === null) {
            content = value;
        } else {
            content = this.getSettings(roomId, eventType) || {};
            content[field] = value;
        }

        await this.client.setRoomAccountData(roomId, eventType, content);

        const deferred = defer<void>();
        const handler = (event: MatrixEvent, room: Room): void => {
            if (room.roomId !== roomId || event.getType() !== eventType) return;
            if (field !== null && event.getContent()[field] !== value) return;
            this.client.off(RoomEvent.AccountData, handler);
            deferred.resolve();
        };
        this.client.on(RoomEvent.AccountData, handler);

        await deferred.promise;
    }

    public setValue(settingName: string, roomId: string, newValue: any): Promise<void> {
        switch (settingName) {
            // Special case URL previews
            case "urlPreviewsEnabled":
                return this.setRoomAccountData(roomId, "org.matrix.room.preview_urls", "disable", !newValue);

            // Special case allowed widgets
            case "allowedWidgets":
                return this.setRoomAccountData(roomId, ALLOWED_WIDGETS_EVENT_TYPE, null, newValue);

            default:
                return this.setRoomAccountData(roomId, DEFAULT_SETTINGS_EVENT_TYPE, settingName, newValue);
        }
    }

    public canSetValue(settingName: string, roomId: string): boolean {
        // If they have the room, they can set their own account data
        return !!this.client.getRoom(roomId);
    }

    public isSupported(): boolean {
        return this.client && !this.client.isGuest();
    }

    private getSettings(roomId: string, eventType = DEFAULT_SETTINGS_EVENT_TYPE): any {
        // TODO: [TS] Type return
        const event = this.client.getRoom(roomId)?.getAccountData(eventType);
        if (!event || !event.getContent()) return null;
        return objectClone(event.getContent()); // clone to prevent mutation
    }
}
