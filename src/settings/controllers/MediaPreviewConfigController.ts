/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ClientEvent, MatrixEvent, MediaPreviewConfig, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { SettingLevel } from "../SettingLevel.ts";
import MatrixClientBackedController from "./MatrixClientBackedController.ts";


const CLIENT_KEY = "m.media_preview_config";

/**
 * TODO
 */
export default class MediaPreviewConfigController extends MatrixClientBackedController {
    private globalSetting: MediaPreviewConfig = MediaPreviewConfig.Private;

    public constructor() {
        super();
    }

    private getRoomValue = (roomId: string): MediaPreviewConfig|null => {
        return this.client?.getRoom(roomId)?.getAccountData(CLIENT_KEY)?.getContent().value ?? null;
    }

    private onAccountData = (event: MatrixEvent): void => {
        // TODO: Validate.
        const roomId = event.getRoomId();
        if (!roomId) {
            this.globalSetting = event.getContent().value;
        }
    };

    protected async initMatrixClient(newClient: MatrixClient, oldClient?: MatrixClient): Promise<void> {
        oldClient?.off(ClientEvent.AccountData, this.onAccountData);
        newClient.on(ClientEvent.AccountData, this.onAccountData);
        const accountData = newClient.getAccountData(CLIENT_KEY);
        if (accountData) this.onAccountData(accountData);
    }

    public getValueOverride(level: SettingLevel, roomId: string | null,): MediaPreviewConfig {
        // TODO: Use SettingLevel?
        if (roomId) {
            return this.getRoomValue(roomId) ?? this.globalSetting;
        }
        return this.globalSetting;
    }

    public get settingDisabled(): boolean | string {
        return false;
    }

    public onChange(_level: SettingLevel, roomId: string | null, newValue: MediaPreviewConfig): void {
        if (roomId) {
            this.client?.setRoomAccountData(roomId, "m.media_preview_config", {
                value: newValue
            });
            return;
        }
        this.client?.setAccountDataRaw( "m.media_preview_config", {
            value: newValue
        });
    }
}
