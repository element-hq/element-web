/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ClientEvent, MatrixEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { AccountDataEvents } from "matrix-js-sdk/src/types";
import { MediaPreviewConfig, MediaPreviewValue } from "../../@types/media_preview.ts";

import { SettingLevel } from "../SettingLevel.ts";
import MatrixClientBackedController from "./MatrixClientBackedController.ts";


const CLIENT_KEY = "io.element.msc4278.media_preview_config";

/**
 * TODO
 */
export default class MediaPreviewConfigController extends MatrixClientBackedController {

    public static readonly default: AccountDataEvents["io.element.msc4278.media_preview_config"] = {
        media_previews: MediaPreviewValue.On,
        invite_avatars: MediaPreviewValue.On
    }

    private globalSetting: MediaPreviewConfig = MediaPreviewConfigController.default;

    public constructor() {
        super();
    }

    private getRoomValue = (roomId: string): MediaPreviewConfig|null => {
        return this.client?.getRoom(roomId)?.getAccountData(CLIENT_KEY)?.getContent<MediaPreviewConfig>() ?? null;
    }

    private onAccountData = (event: MatrixEvent): void => {
        // TODO: Validate.
        const roomId = event.getRoomId();
        if (!roomId) {
            this.globalSetting = event.getContent();
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
            this.client?.setRoomAccountData(roomId, CLIENT_KEY, {
                value: newValue
            });
            return;
        }
        this.client?.setAccountDataRaw(CLIENT_KEY, newValue);
    }
}
